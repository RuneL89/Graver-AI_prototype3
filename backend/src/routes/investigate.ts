import { Router } from "express";
import { LLMClient } from "../llm/client.js";
import { ExaClient } from "../exa/client.js";
import { loadConfig } from "../config/store.js";
import { createGraph } from "../agents/investigationGraph.js";
import { getDb } from "../db/connection.js";
import type { InvestigationState, StageEvent } from "@graver-ai/shared";

const router = Router();

// In-memory investigation store
interface InvestigationSession {
  id: string;
  tip: string;
  status: "running" | "complete" | "error" | "cancelled";
  events: (StageEvent | { type: "reasoning"; stage: string; chunk: string; timestamp: string })[];
  resolvers: Array<() => void>;
  finalState?: InvestigationState;
  error?: string;
  abortController: AbortController;
}

const investigations = new Map<string, InvestigationSession>();

function pushEvent(session: InvestigationSession, event: InvestigationSession["events"][number]) {
  session.events.push(event);
  // Notify all waiting SSE connections
  for (const resolve of session.resolvers) {
    resolve();
  }
  session.resolvers = [];
}

function waitForEvent(session: InvestigationSession): Promise<void> {
  return new Promise((resolve) => {
    session.resolvers.push(resolve);
  });
}

async function runInvestigation(
  id: string,
  tip: string,
  session: InvestigationSession
): Promise<void> {
  try {
    const config = await loadConfig();
    if (!config) {
      throw new Error("No configuration found. Please configure LLM settings first.");
    }

    const llmClient = new LLMClient({
      provider: config.llmProvider,
      apiKey: config.llmApiKey,
      model: config.llmModel,
      baseUrl: config.llmBaseUrl,
      timeoutMs: 120_000,
    });

    const exaClient = config.exaApiKey ? new ExaClient(config.exaApiKey) : undefined;

    const graph = createGraph({
      llmClient,
      exaClient,
      emitEvent: (event) => {
        if (!session.abortController.signal.aborted) {
          pushEvent(session, event);
        }
      },
    });

    const initialState: InvestigationState = {
      id,
      tip: tip.trim(),
      round: 1,
      maxRounds: config.maxInvestigationRounds,
      researchPlan: { tip: tip.trim(), subClaims: [] },
      kbAssignments: [],
      queries: [],
      evidence: [],
      synthesis: [],
      connections: [],
    };

    const finalState = await graph.invoke(initialState as any, {
      configurable: { thread_id: id },
      recursionLimit: 50,
    });

    if (session.abortController.signal.aborted) {
      session.status = "cancelled";
      pushEvent(session, {
        type: "stage_complete",
        stage: "investigation",
        timestamp: new Date().toISOString(),
        payload: { status: "cancelled" },
      });
      return;
    }

    const typedFinalState = finalState as unknown as InvestigationState;
    session.finalState = typedFinalState;
    session.status = "complete";
    pushEvent(session, {
      type: "stage_complete",
      stage: "investigation",
      timestamp: new Date().toISOString(),
      payload: { status: "complete", evidenceCount: typedFinalState.evidence?.length ?? 0 },
    });

    // Persist completed investigation to SQLite
    try {
      const db = getDb();
      const stmt = db.prepare(
        `INSERT INTO investigations (id, tip, status, dossier_json, evidence_json, completed_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           dossier_json = excluded.dossier_json,
           evidence_json = excluded.evidence_json,
           completed_at = excluded.completed_at`
      );
      stmt.run(
        id,
        tip.trim(),
        "complete",
        JSON.stringify(typedFinalState.dossier ?? null),
        JSON.stringify(typedFinalState.rawEvidence ?? null),
        new Date().toISOString()
      );
    } catch (dbErr: any) {
      console.error("Failed to persist investigation:", dbErr.message);
      // Do not fail the investigation because of persistence error
    }
  } catch (err: any) {
    if (session.abortController.signal.aborted) {
      session.status = "cancelled";
      pushEvent(session, {
        type: "stage_complete",
        stage: "investigation",
        timestamp: new Date().toISOString(),
        payload: { status: "cancelled" },
      });
      return;
    }
    session.status = "error";
    session.error = err.message;
    pushEvent(session, {
      type: "error",
      stage: "investigation",
      timestamp: new Date().toISOString(),
      payload: { message: err.message },
    });
  }
}

// POST /api/investigate — start a new investigation
router.post("/investigate", async (req, res) => {
  const { tip } = req.body;
  if (!tip || typeof tip !== "string" || tip.trim().length === 0) {
    return res.status(400).json({ error: "Tip is required" });
  }

  const config = await loadConfig();
  if (!config) {
    return res.status(400).json({ error: "No configuration found. Please configure LLM settings first." });
  }

  const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const session: InvestigationSession = {
    id,
    tip: tip.trim(),
    status: "running",
    events: [],
    resolvers: [],
    abortController: new AbortController(),
  };

  investigations.set(id, session);

  // Start investigation in background
  runInvestigation(id, tip, session);

  res.json({ id, tip: tip.trim(), status: "running" });
});

// DELETE /api/investigate/:id — cancel a running investigation
router.delete("/investigate/:id", (req, res) => {
  const { id } = req.params;
  const session = investigations.get(id);
  if (!session) {
    return res.status(404).json({ error: "Investigation not found" });
  }

  if (session.status !== "running") {
    return res.status(400).json({ error: `Investigation is already ${session.status}` });
  }

  session.abortController.abort();
  session.status = "cancelled";
  pushEvent(session, {
    type: "error",
    stage: "investigation",
    timestamp: new Date().toISOString(),
    payload: { message: "Investigation cancelled by user" },
  });
  pushEvent(session, {
    type: "stage_complete",
    stage: "investigation",
    timestamp: new Date().toISOString(),
    payload: { status: "cancelled" },
  });

  res.json({ id, status: "cancelled" });
});

// POST /api/investigate/:id/retry — retry an investigation from the beginning
router.post("/investigate/:id/retry", async (req, res) => {
  const { id } = req.params;
  const oldSession = investigations.get(id);
  if (!oldSession) {
    return res.status(404).json({ error: "Investigation not found" });
  }

  const newId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const session: InvestigationSession = {
    id: newId,
    tip: oldSession.tip,
    status: "running",
    events: [],
    resolvers: [],
    abortController: new AbortController(),
  };

  investigations.set(newId, session);
  runInvestigation(newId, oldSession.tip, session);

  res.json({ id: newId, tip: oldSession.tip, status: "running" });
});

// GET /api/investigate/:id/stream — SSE endpoint
router.get("/investigate/:id/stream", async (req, res) => {
  const { id } = req.params;
  const session = investigations.get(id);
  if (!session) {
    return res.status(404).json({ error: "Investigation not found" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let sentIndex = 0;

  // Send any existing events first
  while (sentIndex < session.events.length) {
    const event = session.events[sentIndex++];
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  // Keep connection alive and send new events
  const keepAlive = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, 15000);

  const cleanup = () => {
    clearInterval(keepAlive);
    res.end();
  };

  req.on("close", cleanup);
  req.on("error", cleanup);

  try {
    while (session.status === "running") {
      await waitForEvent(session);
      while (sentIndex < session.events.length) {
        const event = session.events[sentIndex++];
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    }

    // Send any remaining events after completion
    while (sentIndex < session.events.length) {
      const event = session.events[sentIndex++];
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Send completion event
    res.write(`data: ${JSON.stringify({ type: "stage_complete", stage: "investigation", timestamp: new Date().toISOString(), payload: { status: session.status } })}\n\n`);
  } catch (err) {
    // Client disconnected
  } finally {
    cleanup();
  }
});

// GET /api/investigate/:id — get investigation status and results
router.get("/investigate/:id", (req, res) => {
  const { id } = req.params;
  const session = investigations.get(id);
  if (!session) {
    return res.status(404).json({ error: "Investigation not found" });
  }

  res.json({
    id: session.id,
    tip: session.tip,
    status: session.status,
    evidenceCount: session.finalState?.evidence?.length ?? 0,
    dossier: session.finalState?.dossier ?? null,
    rawEvidence: session.finalState?.rawEvidence ?? null,
    error: session.error,
  });
});

// GET /api/investigations — list all persisted investigations
router.get("/investigations", (_req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, tip, status, created_at, completed_at
         FROM investigations
         ORDER BY created_at DESC`
      )
      .all() as Array<{
        id: string;
        tip: string;
        status: string;
        created_at: string;
        completed_at: string | null;
      }>;
    res.json({ investigations: rows });
  } catch (err: any) {
    console.error("Failed to list investigations:", err.message);
    res.status(500).json({ error: "Failed to list investigations" });
  }
});

// GET /api/investigations/:id — fetch a single persisted investigation
router.get("/investigations/:id", (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, tip, status, dossier_json, evidence_json, created_at, completed_at
         FROM investigations
         WHERE id = ?`
      )
      .get(id) as
      | {
          id: string;
          tip: string;
          status: string;
          dossier_json: string | null;
          evidence_json: string | null;
          created_at: string;
          completed_at: string | null;
        }
      | undefined;

    if (!row) {
      return res.status(404).json({ error: "Investigation not found" });
    }

    res.json({
      id: row.id,
      tip: row.tip,
      status: row.status,
      dossier: row.dossier_json ? JSON.parse(row.dossier_json) : null,
      rawEvidence: row.evidence_json ? JSON.parse(row.evidence_json) : null,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    });
  } catch (err: any) {
    console.error("Failed to fetch investigation:", err.message);
    res.status(500).json({ error: "Failed to fetch investigation" });
  }
});

export default router;
