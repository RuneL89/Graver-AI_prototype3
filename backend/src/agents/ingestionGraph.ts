import { StateGraph, END } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { getDb } from "../db/connection.js";
import { executeProfilingQueries } from "../db/execution.js";
import { statisticalProfilerSkill } from "../skills/statisticalProfilerSkill.js";
import { wikiArchitectSkill } from "../skills/wikiArchitectSkill.js";
import { wikiWriterSkill } from "../skills/wikiWriterSkill.js";
import { LLMClient } from "../llm/client.js";
import { writePage } from "../wiki/store.js";
import type { TableSchema, WikiPlan, ProfilingResult } from "@graver-ai/shared";

export interface IngestionGraphState {
  jobId: number;
  stage: string;
  schema?: TableSchema;
  queries?: Array<{ description: string; sql: string }>;
  profilingResults?: ProfilingResult[];
  plan?: WikiPlan;
  error?: string;
}

interface GraphServices {
  llmClient: LLMClient;
}

function createGraph(services: GraphServices) {
  const { llmClient } = services;

  const profilerNode = async (state: IngestionGraphState): Promise<Partial<IngestionGraphState>> => {
    const db = getDb();
    db.prepare("UPDATE ingestion_jobs SET status = ? WHERE id = ?").run("profiling", state.jobId);

    try {
      const result = await statisticalProfilerSkill.execute(
        { schema: state.schema },
        { llmClient, wikiStore: null as any, dbConnection: null as any }
      );
      return { queries: result.queries, stage: "profiled" };
    } catch (err: any) {
      db.prepare("UPDATE ingestion_jobs SET status = ? WHERE id = ?").run("error", state.jobId);
      return { error: err.message, stage: "error" };
    }
  };

  const sqlExecutionNode = async (state: IngestionGraphState): Promise<Partial<IngestionGraphState>> => {
    if (!state.schema || !state.queries) return { stage: "error", error: "Missing schema or queries" };

    try {
      const db = getDb();
      const results = executeProfilingQueries(db, state.schema.tableName, state.queries);
      return { profilingResults: results, stage: "executed" };
    } catch (err: any) {
      return { error: err.message, stage: "error" };
    }
  };

  const architectNode = async (state: IngestionGraphState): Promise<Partial<IngestionGraphState>> => {
    const db = getDb();
    db.prepare("UPDATE ingestion_jobs SET status = ? WHERE id = ?").run("planning", state.jobId);

    try {
      if (!state.profilingResults) {
        throw new Error("Missing profiling results");
      }
      const result = await wikiArchitectSkill.execute(
        { schema: state.schema, profilingResults: state.profilingResults },
        { llmClient, wikiStore: null as any, dbConnection: null as any }
      );

      db.prepare("UPDATE ingestion_jobs SET status = ?, plan_json = ? WHERE id = ?")
        .run("awaiting_approval", JSON.stringify(result), state.jobId);

      return { plan: result as WikiPlan, stage: "awaiting_approval" };
    } catch (err: any) {
      db.prepare("UPDATE ingestion_jobs SET status = ? WHERE id = ?").run("error", state.jobId);
      return { error: err.message, stage: "error" };
    }
  };

  const humanGateNode = async (state: IngestionGraphState): Promise<Partial<IngestionGraphState>> => {
    // This node acts as a pause point.
    // The graph will stop here and wait for external approval.
    return { stage: "human_gate" };
  };

  const writerNode = async (state: IngestionGraphState): Promise<Partial<IngestionGraphState>> => {
    const db = getDb();
    db.prepare("UPDATE ingestion_jobs SET status = ?, approved_at = datetime('now') WHERE id = ?")
      .run("writing", state.jobId);

    try {
      const result = await wikiWriterSkill.execute(
        { tableName: state.schema!.tableName, plan: state.plan!, profilingResults: state.profilingResults! },
        { llmClient, wikiStore: null as any, dbConnection: null as any }
      );

      const kbName = state.schema!.tableName;
      for (const page of result.pages) {
        await writePage(kbName, page.path, page.content);
      }

      db.prepare("UPDATE ingestion_jobs SET status = ? WHERE id = ?").run("complete", state.jobId);
      return { stage: "complete" };
    } catch (err: any) {
      db.prepare("UPDATE ingestion_jobs SET status = ? WHERE id = ?").run("error", state.jobId);
      return { error: err.message, stage: "error" };
    }
  };

  const checkpointer = new MemorySaver();

  const graph = new StateGraph<IngestionGraphState>({
    channels: {
      jobId: { value: (x, y) => y ?? x, default: () => 0 },
      stage: { value: (x, y) => y ?? x, default: () => "start" },
      schema: { value: (x, y) => y ?? x },
      queries: { value: (x, y) => y ?? x },
      profilingResults: { value: (x, y) => y ?? x },
      plan: { value: (x, y) => y ?? x },
      error: { value: (x, y) => y ?? x },
    },
  })
    .addNode("profiler", profilerNode)
    .addNode("sqlExecution", sqlExecutionNode)
    .addNode("architect", architectNode)
    .addNode("humanGate", humanGateNode)
    .addNode("writer", writerNode)
    .addEdge("__start__", "profiler")
    .addEdge("profiler", "sqlExecution")
    .addEdge("sqlExecution", "architect")
    .addEdge("architect", "humanGate")
    .addConditionalEdges("humanGate", (state) => {
      if (state.error) return END;
      if (state.stage === "approved") return "writer";
      return END; // Pause here until resumed
    })
    .addEdge("writer", END)
    .compile({ checkpointer });

  return graph;
}

export { createGraph };
