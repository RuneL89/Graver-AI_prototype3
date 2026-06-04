import { Router } from "express";
import multer from "multer";
import { createReadStream } from "fs";
import { readFile, unlink } from "fs/promises";
import { createInterface } from "readline";
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
import type { TableSchema, WikiPlan, WikiStore, ColumnSchema } from "@graver-ai/shared";
import fs from "fs/promises";
import path from "path";

const WIKI_PATH = process.env.WIKI_PATH || "./wiki";
const UPLOAD_TMP_DIR = process.env.UPLOAD_TMP_DIR || "/tmp";

const router = Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_TMP_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: Infinity },
});

function handleMulterError(err: any, res: any) {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large." });
  }
  if (err?.message) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: "Upload failed" });
}

function getLLMClient(): LLMClient | null {
  const provider = process.env.LLM_PROVIDER || "openai";
  const apiKey = process.env.LLM_API_KEY || "";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const baseUrl = process.env.LLM_BASE_URL;
  if (!apiKey) return null;
  return new LLMClient({ provider: provider as any, apiKey, model, baseUrl });
}

// ---------------------------------------------------------------------------
// Streaming NDJSON parser for large files
// ---------------------------------------------------------------------------

function inferColumnType(values: unknown[]): ColumnSchema["type"] {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (nonNull.length === 0) return "TEXT";

  const hasArray = nonNull.some((v) => Array.isArray(v));
  const hasObject = nonNull.some((v) => typeof v === "object" && !Array.isArray(v) && v !== null);
  if (hasArray || hasObject) return "TEXT";

  const allBool = nonNull.every((v) => typeof v === "boolean");
  if (allBool) return "INTEGER";

  const allInt = nonNull.every((v) => /^-?\d+$/.test(String(v)));
  if (allInt) return "INTEGER";

  const allReal = nonNull.every((v) => /^-?\d+(\.\d+)?$/.test(String(v)));
  if (allReal) return "REAL";

  const allDate = nonNull.every((v) => {
    const s = String(v);
    return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{2}\/\d{2}\/\d{4}/.test(s);
  });
  if (allDate) return "DATE";

  return "TEXT";
}

function serializeCell(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number" || typeof val === "string" || typeof val === "bigint") return val;
  if (Buffer.isBuffer(val)) return val;
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

async function streamParseNDJSON(
  filePath: string,
  tableName: string,
  onProgress?: (count: number) => void
): Promise<{ schema: TableSchema; rowCount: number }> {
  const db = getDb();

  // ---- Phase 1: sample first N lines to infer schema ----
  const sampleSize = 5000;
  const sampleLines: string[] = [];
  const sampleStream = createReadStream(filePath, { encoding: "utf-8" });
  const sampleRl = createInterface({ input: sampleStream, crlfDelay: Infinity });

  for await (const line of sampleRl) {
    if (line.trim().length === 0) continue;
    sampleLines.push(line);
    if (sampleLines.length >= sampleSize) break;
  }
  sampleRl.close();

  // Collect all possible column names from sample
  const columnMap = new Map<string, { values: unknown[]; nullable: boolean }>();
  for (const line of sampleLines) {
    const obj = JSON.parse(line) as Record<string, unknown>;
    for (const [key, val] of Object.entries(obj)) {
      const safeKey = key.trim().replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[0-9]/, "_$&").toLowerCase();
      if (!columnMap.has(safeKey)) {
        columnMap.set(safeKey, { values: [], nullable: false });
      }
      const col = columnMap.get(safeKey)!;
      col.values.push(val);
      if (val === null || val === undefined || val === "") {
        col.nullable = true;
      }
    }
  }

  const columns: ColumnSchema[] = Array.from(columnMap.entries()).map(([name, info]) => ({
    name,
    type: inferColumnType(info.values),
    nullable: info.nullable,
    sampleValues: info.values.slice(0, 10),
  }));

  // Create table
  const colDefs = columns.map((c) => `"${c.name}" ${c.type}`).join(", ");
  db.exec(`DROP TABLE IF EXISTS "${tableName}";`);
  db.exec(`CREATE TABLE "${tableName}" (${colDefs});`);

  let colNames = columns.map((c) => `"${c.name}"`).join(", ");
  let placeholders = columns.map(() => "?").join(", ");
  let insertStmt = db.prepare(
    `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`
  );

  // Helper to add new columns dynamically if encountered later
  function ensureColumns(obj: Record<string, unknown>): boolean {
    const keys = Object.keys(obj);
    let added = false;
    for (const key of keys) {
      const safeKey = key.trim().replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[0-9]/, "_$&").toLowerCase();
      if (!columns.find((c) => c.name === safeKey)) {
        columns.push({ name: safeKey, type: "TEXT", nullable: true, sampleValues: [] });
        db.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${safeKey}" TEXT;`);
        added = true;
      }
    }
    if (added) {
      colNames = columns.map((c) => `"${c.name}"`).join(", ");
      placeholders = columns.map(() => "?").join(", ");
      insertStmt = db.prepare(
        `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`
      );
    }
    return added;
  }

  // ---- Phase 2: stream all lines and batch insert ----
  const batchSize = 5000;
  let batch: Record<string, unknown>[] = [];
  let totalRows = 0;

  const stream = createReadStream(filePath, { encoding: "utf-8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  const insertMany = db.transaction((rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const values = columns.map((c) => serializeCell(row[c.name] ?? null));
      insertStmt.run(values);
    }
  });

  for await (const line of rl) {
    if (line.trim().length === 0) continue;
    const obj = JSON.parse(line) as Record<string, unknown>;

    ensureColumns(obj);
    batch.push(obj);
    if (batch.length >= batchSize) {
      insertMany(batch);
      totalRows += batch.length;
      batch = [];
      if (onProgress) onProgress(totalRows);
    }
  }

  if (batch.length > 0) {
    insertMany(batch);
    totalRows += batch.length;
  }

  rl.close();

  const schema: TableSchema = {
    tableName,
    columns,
    foreignKeys: columns
      .map((c) => c.name)
      .filter((name) => /_id$|_cvr$|_key$/.test(name)),
    rowCount: totalRows,
    sampleRows: sampleLines
      .slice(0, 50)
      .map((line) => JSON.parse(line) as Record<string, unknown>),
  };

  return { schema, rowCount: totalRows };
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

router.post("/ingest/upload", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) return handleMulterError(err, res);
    next();
  });
}, async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const originalName = file.originalname;
  const ext = originalName.split(".").pop()?.toLowerCase();
  const tempPath = file.path;

  if (!ext || !["csv", "json"].includes(ext)) {
    await unlink(tempPath).catch(() => {});
    return res.status(400).json({ error: "Only CSV and JSON files are supported" });
  }

  const tableName = generateTableName(originalName);
  const wikiName = (req.body.wikiName as string)?.trim() || tableName;

  try {
    let schema: TableSchema;
    let rowCount: number;

    if (ext === "csv") {
      const buffer = await readFile(tempPath);
      const parsed = parseCSV(buffer);
      parsed.schema.tableName = tableName;
      schema = parsed.schema;
      rowCount = parsed.rows.length;

      const db = getDb();
      const colDefs = parsed.schema.columns
        .map((c) => `"${c.name}" ${c.type}`)
        .join(", ");
      db.exec(`DROP TABLE IF EXISTS "${tableName}";`);
      db.exec(`CREATE TABLE "${tableName}" (${colDefs});`);

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
    } else {
      // JSON: use streaming NDJSON parser for any size
      const result = await streamParseNDJSON(tempPath, tableName);
      schema = result.schema;
      rowCount = result.rowCount;
    }

    // Clean up temp file
    await unlink(tempPath).catch(() => {});

    // Create job record
    const db = getDb();
    const schemaJson = JSON.stringify(schema);
    const result = db
      .prepare(
        `INSERT INTO ingestion_jobs (status, filename, schema_json, wiki_name) VALUES (?, ?, ?, ?) RETURNING id`
      )
      .get("uploaded", originalName, schemaJson, wikiName) as { id: number };

    res.json({ success: true, jobId: result.id, tableName, wikiName, rowCount, schema });
  } catch (err: any) {
    await unlink(tempPath).catch(() => {});
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
