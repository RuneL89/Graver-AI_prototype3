import { Router } from "express";
import multer from "multer";
import { getDb } from "../db/connection.js";
import { parseCSV, parseJSON, generateTableName } from "../db/parser.js";
import { executeProfilingQueries } from "../db/execution.js";
import { statisticalProfilerSkill } from "../skills/statisticalProfilerSkill.js";
import { wikiArchitectSkill } from "../skills/wikiArchitectSkill.js";
import { wikiWriterSkill } from "../skills/wikiWriterSkill.js";
import { wikiPlanModifierSkill } from "../skills/wikiPlanModifierSkill.js";
import { LLMClient } from "../llm/client.js";
import { loadConfig } from "../config/store.js";
import { writePage, readPage, listPages, deletePage } from "../wiki/store.js";
import type { TableSchema, WikiPlan, WikiStore } from "@graver-ai/shared";
import fs from "fs/promises";
import path from "path";

const WIKI_PATH = process.env.WIKI_PATH || "./wiki";

const router = Router();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

function getLLMClient(): LLMClient | null {
  const provider = process.env.LLM_PROVIDER || "openai";
  const apiKey = process.env.LLM_API_KEY || "";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const baseUrl = process.env.LLM_BASE_URL;
  if (!apiKey) return null;
  return new LLMClient({ provider: provider as any, apiKey, model, baseUrl });
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

router.post("/ingest/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const originalName = file.originalname;
  const ext = originalName.split(".").pop()?.toLowerCase();

  if (!ext || !["csv", "json"].includes(ext)) {
    return res.status(400).json({ error: "Only CSV and JSON files are supported" });
  }

  try {
    const parsed = ext === "csv" ? parseCSV(file.buffer) : parseJSON(file.buffer);
    const tableName = generateTableName(originalName);
    parsed.schema.tableName = tableName;

    const db = getDb();

    // Create table
    const colDefs = parsed.schema.columns
      .map((c) => `"${c.name}" ${c.type}`)
      .join(", ");
    db.exec(`DROP TABLE IF EXISTS "${tableName}";`);
    db.exec(`CREATE TABLE "${tableName}" (${colDefs});`);

    // Insert rows
    const colNames = parsed.schema.columns.map((c) => `"${c.name}"`).join(", ");
    const placeholders = parsed.schema.columns.map(() => "?").join(", ");
    const insertStmt = db.prepare(
      `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`
    );

    const insertMany = db.transaction((rows: Record<string, unknown>[]) => {
      for (const row of rows) {
        const values = parsed.schema.columns.map((c) => row[c.name] ?? null);
        insertStmt.run(values);
      }
    });

    insertMany(parsed.rows);

    // Determine wiki name
    const wikiName = (req.body.wikiName as string)?.trim() || tableName;

    // Create job record
    const schemaJson = JSON.stringify(parsed.schema);
    const result = db
      .prepare(
        `INSERT INTO ingestion_jobs (status, filename, schema_json, wiki_name) VALUES (?, ?, ?, ?) RETURNING id`
      )
      .get("uploaded", originalName, schemaJson, wikiName) as { id: number };

    res.json({ success: true, jobId: result.id, tableName, wikiName, rowCount: parsed.rows.length, schema: parsed.schema });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

router.post("/ingest/profile/:jobId", async (req, res) => {
  const jobId = Number(req.params.jobId);
  const db = getDb();

  const job = db
    .prepare("SELECT * FROM ingestion_jobs WHERE id = ?")
    .get(jobId) as any;

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const schema: TableSchema = JSON.parse(job.schema_json);
  const config = await loadConfig();
  const llmClient = config
    ? new LLMClient({
        provider: config.llmProvider,
        apiKey: config.llmApiKey,
        model: config.llmModel,
        baseUrl: config.llmBaseUrl,
        timeoutMs: 60_000,
      })
    : getLLMClient();

  if (!llmClient) {
    return res.status(503).json({ error: "LLM not configured" });
  }

  try {
    db.prepare(
      "UPDATE ingestion_jobs SET status = ? WHERE id = ?"
    ).run("profiling", jobId);

    const profileResult = await statisticalProfilerSkill.execute(
      { schema },
      { llmClient, wikiStore: null as any, dbConnection: null as any }
    );

    db.prepare(
      "UPDATE ingestion_jobs SET status = ? WHERE id = ?"
    ).run("planning", jobId);

    res.json({ success: true, queries: profileResult.queries });
  } catch (err: any) {
    db.prepare(
      "UPDATE ingestion_jobs SET status = ? WHERE id = ?"
    ).run("error", jobId);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Execute profiling queries
// ---------------------------------------------------------------------------

router.post("/ingest/execute/:jobId", async (req, res) => {
  const jobId = Number(req.params.jobId);
  const { queries } = req.body;

  const db = getDb();
  const job = db
    .prepare("SELECT * FROM ingestion_jobs WHERE id = ?")
    .get(jobId) as any;

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const schema: TableSchema = JSON.parse(job.schema_json);

  try {
    const results = executeProfilingQueries(db, schema.tableName, queries);
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Architect (generate plan)
// ---------------------------------------------------------------------------

router.post("/ingest/architect/:jobId", async (req, res) => {
  const jobId = Number(req.params.jobId);
  const { profilingResults } = req.body;

  const db = getDb();
  const job = db
    .prepare("SELECT * FROM ingestion_jobs WHERE id = ?")
    .get(jobId) as any;

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const schema: TableSchema = JSON.parse(job.schema_json);
  const config = await loadConfig();
  const llmClient = config
    ? new LLMClient({
        provider: config.llmProvider,
        apiKey: config.llmApiKey,
        model: config.llmModel,
        baseUrl: config.llmBaseUrl,
        timeoutMs: 60_000,
      })
    : getLLMClient();

  if (!llmClient) {
    return res.status(503).json({ error: "LLM not configured" });
  }

  try {
    const wikiStore: WikiStore = { readPage, writePage, listPages, deletePage };
    const plan = await wikiArchitectSkill.execute(
      { schema, profilingResults, targetKb: job.wiki_name },
      { llmClient, wikiStore, dbConnection: null as any }
    );

    db.prepare(
      "UPDATE ingestion_jobs SET status = ?, plan_json = ? WHERE id = ?"
    ).run("awaiting_approval", JSON.stringify(plan), jobId);

    res.json({ success: true, plan });
  } catch (err: any) {
    db.prepare(
      "UPDATE ingestion_jobs SET status = ? WHERE id = ?"
    ).run("error", jobId);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Get plan
// ---------------------------------------------------------------------------

router.get("/ingest/plan/:jobId", async (req, res) => {
  const jobId = Number(req.params.jobId);
  const db = getDb();

  const job = db
    .prepare("SELECT * FROM ingestion_jobs WHERE id = ?")
    .get(jobId) as any;

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (!job.plan_json) {
    return res.status(404).json({ error: "No plan available for this job" });
  }

  res.json({ plan: JSON.parse(job.plan_json), status: job.status });
});

// ---------------------------------------------------------------------------
// Modify plan with user prompt
// ---------------------------------------------------------------------------

router.post("/ingest/modify/:jobId", async (req, res) => {
  const jobId = Number(req.params.jobId);
  const { currentPlan, profilingResults, modificationPrompt } = req.body;

  const db = getDb();
  const job = db
    .prepare("SELECT * FROM ingestion_jobs WHERE id = ?")
    .get(jobId) as any;

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const schema: TableSchema = JSON.parse(job.schema_json);
  const config = await loadConfig();
  const llmClient = config
    ? new LLMClient({
        provider: config.llmProvider,
        apiKey: config.llmApiKey,
        model: config.llmModel,
        baseUrl: config.llmBaseUrl,
        timeoutMs: 120_000,
      })
    : getLLMClient();

  if (!llmClient) {
    return res.status(503).json({ error: "LLM not configured" });
  }

  try {
    const revisedPlan = await wikiPlanModifierSkill.execute(
      { schema, currentPlan, profilingResults, modificationPrompt },
      { llmClient, wikiStore: null as any, dbConnection: null as any }
    );

    db.prepare(
      "UPDATE ingestion_jobs SET plan_json = ? WHERE id = ?"
    ).run(JSON.stringify(revisedPlan), jobId);

    res.json({ success: true, plan: revisedPlan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Approve plan and write wiki
// ---------------------------------------------------------------------------

router.post("/ingest/approve/:jobId", async (req, res) => {
  const jobId = Number(req.params.jobId);
  const { plan, profilingResults } = req.body;

  const db = getDb();
  const job = db
    .prepare("SELECT * FROM ingestion_jobs WHERE id = ?")
    .get(jobId) as any;

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const schema: TableSchema = JSON.parse(job.schema_json);
  const config = await loadConfig();
  const llmClient = config
    ? new LLMClient({
        provider: config.llmProvider,
        apiKey: config.llmApiKey,
        model: config.llmModel,
        baseUrl: config.llmBaseUrl,
        timeoutMs: 120_000,
      })
    : getLLMClient();

  if (!llmClient) {
    return res.status(503).json({ error: "LLM not configured" });
  }

  try {
    db.prepare(
      "UPDATE ingestion_jobs SET status = ?, plan_json = ?, approved_at = datetime('now') WHERE id = ?"
    ).run("writing", JSON.stringify(plan), jobId);

    const kbName = job.wiki_name || schema.tableName;

    const wikiStore: WikiStore = { readPage, writePage, listPages, deletePage };
    const wikiResult = await wikiWriterSkill.execute(
      { tableName: schema.tableName, plan, profilingResults, targetKb: job.wiki_name },
      { llmClient, wikiStore, dbConnection: null as any }
    );

    // Write pages to wiki
    for (const page of wikiResult.pages) {
      await writePage(kbName, page.path, page.content);
    }

    // Write display name metadata
    const safeKbName = kbName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const metaPath = path.join(WIKI_PATH, safeKbName, "_meta.json");
    await fs.writeFile(metaPath, JSON.stringify({ displayName: kbName }), "utf-8");

    db.prepare(
      "UPDATE ingestion_jobs SET status = ? WHERE id = ?"
    ).run("complete", jobId);

    res.json({ success: true, pagesWritten: wikiResult.pages.length });
  } catch (err: any) {
    db.prepare(
      "UPDATE ingestion_jobs SET status = ? WHERE id = ?"
    ).run("error", jobId);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Reject plan
// ---------------------------------------------------------------------------

router.post("/ingest/reject/:jobId", async (req, res) => {
  const jobId = Number(req.params.jobId);
  const db = getDb();

  db.prepare(
    "UPDATE ingestion_jobs SET status = ?, plan_json = NULL WHERE id = ?"
  ).run("uploaded", jobId);

  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Get job status
// ---------------------------------------------------------------------------

router.get("/ingest/job/:jobId", async (req, res) => {
  const jobId = Number(req.params.jobId);
  const db = getDb();

  const job = db
    .prepare("SELECT id, status, filename, schema_json, plan_json, approved_at, created_at FROM ingestion_jobs WHERE id = ?")
    .get(jobId) as any;

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json(job);
});

export default router;
