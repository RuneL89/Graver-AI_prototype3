import { Router } from "express";
import { LLMClient } from "../llm/client.js";
import { ExaClient } from "../exa/client.js";
import { loadConfig } from "../config/store.js";
import { createGraph } from "../agents/investigationGraph.js";
import type { InvestigationState, StageEvent } from "@graver-ai/shared";

const router = Router();

// In-memory investigation store
interface InvestigationSession {
  id: string;
  tip: string;
  status: "running" | "complete" | "error";
  events: (StageEvent | { type: "reasoning"; stage: string; chunk: string; timestamp: string })[];
  resolvers: Array<() => void>;
  finalState?: InvestigationState;
  error?: string;
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
  };

  investigations.set(id, session);

  // Start investigation in background
  (async () => {
    try {
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
        emitEvent: (event) => pushEvent(session, event),
      });

      const initialState: InvestigationState = {
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

      const finalState = await graph.invoke(initialState, {
        configurable: { thread_id: id },
      });

      session.finalState = finalState as InvestigationState;
      session.status = "complete";
      pushEvent(session, {
        type: "stage_complete",
        stage: "investigation",
        timestamp: new Date().toISOString(),
        payload: { status: "complete", evidenceCount: finalState.evidence?.length ?? 0 },
      });
    } catch (err: any) {
      session.status = "error";
      session.error = err.message;
      pushEvent(session, {
        type: "error",
        stage: "investigation",
        timestamp: new Date().toISOString(),
        payload: { message: err.message },
      });
    }
  })();

  res.json({ id, tip: tip.trim(), status: "running" });
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
    clearInterval(keepAlive);
    res.end();
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
    error: session.error,
  });
});

export default router;
