import { StateGraph, END } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { LLMClient } from "../llm/client.js";
import { ExaClient } from "../exa/client.js";
import { tipDecomposerSkill } from "../skills/tipDecomposerSkill.js";
import { kbNavigatorSkill } from "../skills/kbNavigatorSkill.js";
import { queryGeneratorSkill } from "../skills/queryGeneratorSkill.js";
import { entityResolverSkill } from "../skills/entityResolverSkill.js";
import { evidenceSynthesizerSkill } from "../skills/evidenceSynthesizerSkill.js";
import { gapAuditorSkill } from "../skills/gapAuditorSkill.js";
import { dossierAssemblerSkill } from "../skills/dossierAssemblerSkill.js";
import { gapDiscoverySkill } from "../skills/gapDiscoverySkill.js";
import { wikiWritebackSkill } from "../skills/wikiWritebackSkill.js";
import { executeQueries } from "./queryExecutor.js";
import { readPage, writePage, listPages, deletePage } from "../wiki/store.js";
import { getDb } from "../db/connection.js";
import type {
  InvestigationState,
  SubClaim,
  KBAssignment,
  Query,
  EvidenceBundle,
  Synthesis,
  ConnectionFinding,
  Dossier,
  StageEvent,
} from "@graver-ai/shared";

export interface InvestigationGraphServices {
  llmClient: LLMClient;
  exaClient?: ExaClient;
  emitEvent: (event: StageEvent | { type: "reasoning"; stage: string; chunk: string; timestamp: string }) => void;
}

function emit(
  emitEvent: InvestigationGraphServices["emitEvent"],
  type: StageEvent["type"] | "reasoning",
  stage: string,
  payload?: Record<string, unknown> | string
) {
  const timestamp = new Date().toISOString();
  if (type === "reasoning" && typeof payload === "string") {
    emitEvent({ type: "reasoning", stage, chunk: payload, timestamp });
  } else {
    emitEvent({ type: type as StageEvent["type"], stage, timestamp, payload: payload as Record<string, unknown> });
  }
}

async function gatherKbIndexes(): Promise<{ kbName: string; indexContent: string }[]> {
  const db = getDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'kb_%'"
  ).all() as { name: string }[];

  const indexes: { kbName: string; indexContent: string }[] = [];

  for (const { name } of tables) {
    try {
      const content = await readPage(name, "index.md");
      if (content) {
        indexes.push({ kbName: name, indexContent: content });
      }
    } catch {
      // skip if no wiki index
    }
  }

  return indexes;
}

async function gatherKbSchemas(kbNames: string[]): Promise<{ kbName: string; tableName: string; columns: { name: string; type: string }[] }[]> {
  const db = getDb();
  const schemas: { kbName: string; tableName: string; columns: { name: string; type: string }[] }[] = [];

  for (const kbName of kbNames) {
    try {
      const cols = db.prepare(`PRAGMA table_info("${kbName}")`).all() as { name: string; type: string }[];
      if (cols.length > 0) {
        schemas.push({ kbName, tableName: kbName, columns: cols.map((c) => ({ name: c.name, type: c.type })) });
      }
    } catch {
      // skip
    }
  }

  return schemas;
}

function buildCumulativeContext(state: InvestigationState): string {
  if (state.round <= 1 || state.evidence.length === 0) return "";
  const evidenceSummary = state.evidence.map((e) =>
    `- ${e.subClaimId} (${e.sourceType}): ${e.results.length} results`
  ).join("\n");
  const connectionSummary = state.connections.map((c) =>
    `- ${c.entityIdentifier} (${c.confidence})`
  ).join("\n");
  return `Prior evidence:\n${evidenceSummary}\n\nPrior connections:\n${connectionSummary || "(none)"}`;
}

function createGraph(services: InvestigationGraphServices) {
  const { llmClient, exaClient, emitEvent } = services;

  const wikiStore = {
    readPage,
    writePage,
    listPages,
    deletePage,
  };

  const decomposerNode = async (state: InvestigationState): Promise<Partial<InvestigationState>> => {
    emit(emitEvent, "stage_start", "decomposer", { round: state.round });

    const kbIndexes = await gatherKbIndexes();

    const result = await tipDecomposerSkill.execute(
      { tip: state.tip, kbIndexes },
      {
        llmClient,
        wikiStore,
        dbConnection: null as any,
        emitReasoning: (chunk) => emit(emitEvent, "reasoning", "decomposer", chunk),
      }
    );

    const subClaims: SubClaim[] = result.subClaims.map((sc) => ({
      id: sc.id,
      claimText: sc.claimText,
      targetEntityType: sc.targetEntityType,
    }));

    emit(emitEvent, "stage_complete", "decomposer", {
      subClaimCount: subClaims.length,
      subClaims: subClaims.map((s) => ({ id: s.id, claimText: s.claimText })),
    });

    return { researchPlan: { tip: state.tip, subClaims } };
  };

  const navigatorNode = async (state: InvestigationState): Promise<Partial<InvestigationState>> => {
    emit(emitEvent, "stage_start", "navigator", { round: state.round });

    const kbIndexes = await gatherKbIndexes();
    const assignments: KBAssignment[] = [];
    const cumulativeContext = buildCumulativeContext(state);

    for (const subClaim of state.researchPlan.subClaims) {
      const enrichedSubClaim = {
        id: subClaim.id,
        claimText: subClaim.claimText,
        researchQuestion: subClaim.claimText,
        targetEntityType: subClaim.targetEntityType,
        suggestedKbs: [],
      };

      const result = await kbNavigatorSkill.execute(
        { subClaim: enrichedSubClaim, kbIndexes, cumulativeContext: cumulativeContext || undefined },
        {
          llmClient,
          wikiStore,
          dbConnection: null as any,
          emitReasoning: (chunk) => emit(emitEvent, "reasoning", "navigator", chunk),
        }
      );

      for (const a of result.assignments) {
        assignments.push({
          subClaimId: subClaim.id,
          kbName: a.kbName,
          sourceType: a.sourceType,
          relevanceScore: a.relevanceScore,
          justification: a.justification,
        });
      }
    }

    emit(emitEvent, "stage_complete", "navigator", {
      assignmentCount: assignments.length,
      assignments: assignments.map((a) => ({
        kbName: a.kbName,
        subClaimId: a.subClaimId,
        relevanceScore: a.relevanceScore,
      })),
    });

    return { kbAssignments: assignments };
  };

  const generatorNode = async (state: InvestigationState): Promise<Partial<InvestigationState>> => {
    emit(emitEvent, "stage_start", "generator", { round: state.round });

    const sqliteKbs = [...new Set(state.kbAssignments.filter((a) => a.sourceType === "sqlite").map((a) => a.kbName))];
    const kbSchemas = await gatherKbSchemas(sqliteKbs);

    const queries: Query[] = [];

    for (const subClaim of state.researchPlan.subClaims) {
      const subClaimAssignments = state.kbAssignments.filter((a) => a.subClaimId === subClaim.id);

      if (subClaimAssignments.length === 0) continue;

      const result = await queryGeneratorSkill.execute(
        {
          subClaim: {
            id: subClaim.id,
            claimText: subClaim.claimText,
            researchQuestion: subClaim.claimText,
            targetEntityType: subClaim.targetEntityType,
          },
          kbAssignments: subClaimAssignments,
          kbSchemas,
        },
        {
          llmClient,
          wikiStore,
          dbConnection: null as any,
          emitReasoning: (chunk) => emit(emitEvent, "reasoning", "generator", chunk),
        }
      );

      for (const q of result.queries) {
        if (q.type === "sql") {
          queries.push({
            type: "sql",
            subClaimId: q.subClaimId,
            kbName: q.kbName,
            description: q.description,
            sql: q.sql,
          });
        } else {
          queries.push({
            type: "exa",
            subClaimId: q.subClaimId,
            query: q.query,
            numResults: q.numResults,
            includeDomains: q.includeDomains,
            excludeDomains: q.excludeDomains,
            startPublishedDate: q.startPublishedDate,
            endPublishedDate: q.endPublishedDate,
            category: q.category,
          });
        }
      }
    }

    emit(emitEvent, "stage_complete", "generator", {
      queryCount: queries.length,
      queries: queries.map((q) => ({
        type: q.type,
        subClaimId: q.subClaimId,
        ...(q.type === "sql" ? { description: q.description } : { query: q.query }),
      })),
    });

    return { queries };
  };

  const executorNode = async (state: InvestigationState): Promise<Partial<InvestigationState>> => {
    emit(emitEvent, "stage_start", "executor", { round: state.round });

    const { evidence, errors } = await executeQueries(state.queries, exaClient);

    if (errors.length > 0) {
      for (const err of errors) {
        emit(emitEvent, "reasoning", "executor", `Error: ${err}\n`);
      }
    }

    emit(emitEvent, "stage_complete", "executor", {
      evidenceCount: evidence.length,
      errorCount: errors.length,
      evidence: evidence.map((e) => ({
        subClaimId: e.subClaimId,
        sourceType: e.sourceType,
        resultCount: e.results.length,
      })),
    });

    return { evidence };
  };

  const resolverNode = async (state: InvestigationState): Promise<Partial<InvestigationState>> => {
    emit(emitEvent, "stage_start", "resolver", { round: state.round });

    const result = await entityResolverSkill.execute(
      { evidence: state.evidence as EvidenceBundle[], tip: state.tip },
      {
        llmClient,
        wikiStore,
        dbConnection: null as any,
        emitReasoning: (chunk) => emit(emitEvent, "reasoning", "resolver", chunk),
      }
    );

    emit(emitEvent, "stage_complete", "resolver", {
      connectionCount: result.connections.length,
      contradictionCount: result.contradictions.length,
    });

    return { connections: result.connections };
  };

  const synthesizerNode = async (state: InvestigationState): Promise<Partial<InvestigationState>> => {
    emit(emitEvent, "stage_start", "synthesizer", { round: state.round });

    const result = await evidenceSynthesizerSkill.execute(
      {
        evidence: state.evidence as EvidenceBundle[],
        connections: state.connections as ConnectionFinding[],
        subClaims: state.researchPlan.subClaims,
        tip: state.tip,
      },
      {
        llmClient,
        wikiStore,
        dbConnection: null as any,
        emitReasoning: (chunk) => emit(emitEvent, "reasoning", "synthesizer", chunk),
      }
    );

    emit(emitEvent, "stage_complete", "synthesizer", {
      synthesisCount: result.entries.length,
    });

    return { synthesis: result.entries };
  };

  const auditorNode = async (state: InvestigationState): Promise<Partial<InvestigationState>> => {
    emit(emitEvent, "stage_start", "auditor", { round: state.round });

    const result = await gapAuditorSkill.execute(
      {
        synthesis: state.synthesis as Synthesis[],
        connections: state.connections as ConnectionFinding[],
        evidence: state.evidence as EvidenceBundle[],
        subClaims: state.researchPlan.subClaims,
        round: state.round,
        maxRounds: state.maxRounds,
        tip: state.tip,
      },
      {
        llmClient,
        wikiStore,
        dbConnection: null as any,
        emitReasoning: (chunk) => emit(emitEvent, "reasoning", "auditor", chunk),
      }
    );

    emit(emitEvent, "stage_complete", "auditor", {
      decision: result.decision,
      suggestedQueryCount: result.suggestedQueries.length,
    });

    return { auditDecision: result.decision };
  };

  const incrementRoundNode = async (state: InvestigationState): Promise<Partial<InvestigationState>> => {
    emit(emitEvent, "stage_start", "incrementRound", { round: state.round });
    const newRound = state.round + 1;
    emit(emitEvent, "stage_complete", "incrementRound", { newRound });
    return { round: newRound };
  };

  const assemblerNode = async (state: InvestigationState): Promise<Partial<InvestigationState>> => {
    emit(emitEvent, "stage_start", "assembler", { round: state.round });

    // Run gap discovery first if there are gaps
    let gapSuggestions: string[] = [];
    if (state.auditDecision === "STOP_WITH_GAPS") {
      const gapResult = await gapDiscoverySkill.execute(
        {
          auditDecision: state.auditDecision,
          auditReasoning: "Investigation stopped with gaps.",
          synthesis: state.synthesis as Synthesis[],
          subClaims: state.researchPlan.subClaims,
          tip: state.tip,
        },
        {
          llmClient,
          wikiStore,
          dbConnection: null as any,
          emitReasoning: (chunk) => emit(emitEvent, "reasoning", "assembler", chunk),
        }
      );
      gapSuggestions = gapResult.suggestions;
    }

    const result = await dossierAssemblerSkill.execute(
      {
        synthesis: state.synthesis as Synthesis[],
        connections: state.connections as ConnectionFinding[],
        evidence: state.evidence as EvidenceBundle[],
        auditDecision: state.auditDecision,
        auditReasoning: "See auditor output.",
        tip: state.tip,
        round: state.round,
        gapSuggestions,
      },
      {
        llmClient,
        wikiStore,
        dbConnection: null as any,
        emitReasoning: (chunk) => emit(emitEvent, "reasoning", "assembler", chunk),
      }
    );

    emit(emitEvent, "stage_complete", "assembler", {
      findingsCount: result.findings.length,
      connectionsCount: result.connections.length,
      gapsCount: result.gaps.length,
    });

    return { dossier: result as Dossier };
  };

  const writebackNode = async (state: InvestigationState): Promise<Partial<InvestigationState>> => {
    emit(emitEvent, "stage_start", "writeback", { round: state.round });

    if (!state.dossier) {
      emit(emitEvent, "reasoning", "writeback", "No dossier to write back.\n");
      emit(emitEvent, "stage_complete", "writeback", { pagesWritten: 0 });
      return {};
    }

    const investigationId = `inv-${Date.now()}`;

    const result = await wikiWritebackSkill.execute(
      {
        dossier: state.dossier,
        investigationId,
        connections: state.connections as ConnectionFinding[],
        tip: state.tip,
      },
      {
        llmClient,
        wikiStore,
        dbConnection: null as any,
        emitReasoning: (chunk) => emit(emitEvent, "reasoning", "writeback", chunk),
      }
    );

    emit(emitEvent, "stage_complete", "writeback", {
      pagesWritten: result.pagesWritten.length,
      pages: result.pagesWritten,
    });

    return {};
  };

  const checkpointer = new MemorySaver();

  const graph = new StateGraph<InvestigationState>({
    channels: {
      tip: { value: (x, y) => y ?? x, default: () => "" },
      round: { value: (x, y) => y ?? x, default: () => 1 },
      maxRounds: { value: (x, y) => y ?? x, default: () => 5 },
      researchPlan: { value: (x, y) => y ?? x, default: () => ({ tip: "", subClaims: [] }) },
      kbAssignments: { value: (x, y) => y ?? x, default: () => [] },
      queries: { value: (x, y) => y ?? x, default: () => [] },
      evidence: { value: (x, y) => [...(x || []), ...(y || [])], default: () => [] },
      synthesis: { value: (x, y) => y ?? x, default: () => [] },
      connections: { value: (x, y) => y ?? x, default: () => [] },
      dossier: { value: (x, y) => y ?? x },
      auditDecision: { value: (x, y) => y ?? x },
      error: { value: (x, y) => y ?? x },
    },
  })
    .addNode("decomposer", decomposerNode)
    .addNode("navigator", navigatorNode)
    .addNode("generator", generatorNode)
    .addNode("executor", executorNode)
    .addNode("resolver", resolverNode)
    .addNode("synthesizer", synthesizerNode)
    .addNode("auditor", auditorNode)
    .addNode("incrementRound", incrementRoundNode)
    .addNode("assembler", assemblerNode)
    .addNode("writeback", writebackNode)
    .addEdge("__start__", "decomposer")
    .addEdge("decomposer", "navigator")
    .addEdge("navigator", "generator")
    .addEdge("generator", "executor")
    .addEdge("executor", "resolver")
    .addEdge("resolver", "synthesizer")
    .addEdge("synthesizer", "auditor")
    .addConditionalEdges("auditor", (state) => {
      if (state.round >= state.maxRounds) return "assembler";
      if (state.auditDecision === "CONTINUE") return "incrementRound";
      return "assembler";
    })
    .addEdge("incrementRound", "navigator")
    .addEdge("assembler", "writeback")
    .addEdge("writeback", END)
    .compile({ checkpointer });

  return graph;
}

export { createGraph };
