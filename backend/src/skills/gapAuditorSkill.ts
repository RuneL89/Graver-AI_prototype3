import { z } from "zod";
import type { AgentSkill, AgentContext, Synthesis, ConnectionFinding, EvidenceBundle, Query } from "@graver-ai/shared";

const inputSchema = z.object({
  synthesis: z.array(z.object({
    subClaimId: z.string(),
    narrative: z.string(),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    contradictions: z.array(z.string()),
  })),
  connections: z.array(z.object({
    entityIdentifier: z.string(),
    sources: z.array(z.string()),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    notes: z.string(),
  })),
  evidence: z.array(z.object({
    subClaimId: z.string(),
    sourceType: z.enum(["sqlite", "exa"]),
    query: z.string(),
    results: z.array(z.unknown()),
    timestamp: z.string(),
  })),
  subClaims: z.array(z.object({
    id: z.string(),
    claimText: z.string(),
    targetEntityType: z.string(),
  })),
  round: z.number(),
  maxRounds: z.number(),
  tip: z.string(),
});

// Lenient raw schema
const rawSuggestedQuerySchema = z.object({
  type: z.enum(["sql", "exa"]).optional(),
  queryType: z.enum(["sql", "exa"]).optional(),
  subClaimId: z.string().optional(),
  sub_claim_id: z.string().optional(),
  kbName: z.string().optional(),
  kb_name: z.string().optional(),
  description: z.string().optional(),
  desc: z.string().optional(),
  sql: z.string().optional(),
  query: z.string().optional(),
  searchQuery: z.string().optional(),
});

const rawOutputSchema = z.object({
  decision: z.enum(["CONTINUE", "STOP_COMPLETE", "STOP_WITH_GAPS"]).optional(),
  reasoning: z.string().optional(),
  suggestedQueries: z.array(rawSuggestedQuerySchema).optional(),
  suggested_queries: z.array(rawSuggestedQuerySchema).optional(),
});

const outputSchema = z.object({
  decision: z.enum(["CONTINUE", "STOP_COMPLETE", "STOP_WITH_GAPS"]),
  reasoning: z.string(),
  suggestedQueries: z.array(z.union([
    z.object({
      type: z.literal("sql"),
      subClaimId: z.string(),
      kbName: z.string(),
      description: z.string(),
      sql: z.string(),
    }),
    z.object({
      type: z.literal("exa"),
      subClaimId: z.string(),
      query: z.string(),
    }),
  ])),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

function normalizeAuditorResult(raw: z.infer<typeof rawOutputSchema>): Output {
  const decision = raw.decision || "STOP_WITH_GAPS";
  const reasoning = raw.reasoning || "(no reasoning provided)";

  const rawQueries = raw.suggestedQueries || raw.suggested_queries || [];
  const suggestedQueries: Query[] = [];

  for (const q of rawQueries) {
    const queryType = q.type || q.queryType || "exa";
    const subClaimId = q.subClaimId || q.sub_claim_id || "unknown";
    if (queryType === "sql") {
      const sql = q.sql || q.query;
      if (!sql) continue;
      suggestedQueries.push({
        type: "sql",
        subClaimId,
        kbName: q.kbName || q.kb_name || "unknown",
        description: q.description || q.desc || "Suggested SQL query",
        sql,
      });
    } else {
      const searchQuery = q.query || q.searchQuery;
      if (!searchQuery) continue;
      suggestedQueries.push({
        type: "exa",
        subClaimId,
        query: searchQuery,
      });
    }
  }

  return { decision, reasoning, suggestedQueries };
}

export const gapAuditorSkill: AgentSkill<Input, Output> = {
  name: "gapAuditor",
  description:
    "Evaluates the cumulative investigation state and decides whether to continue, stop complete, or stop with gaps.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    const evidenceSummary = input.evidence.map((e) =>
      `- ${e.subClaimId} (${e.sourceType}): ${e.results.length} results`
    ).join("\n");

    const synthesisSummary = input.synthesis.map((s) =>
      `- ${s.subClaimId}: ${s.confidence} — ${s.narrative.slice(0, 120)}...`
    ).join("\n");

    const connectionSummary = input.connections.map((c) =>
      `- ${c.entityIdentifier} (${c.confidence})`
    ).join("\n");

    const prompt = `You are an investigation gap auditor. Evaluate whether the investigation should continue, stop as complete, or stop with gaps.

TIP BEING INVESTIGATED:
"""${input.tip}"""

CURRENT ROUND: ${input.round} of ${input.maxRounds}

SUB-CLAIMS:
${input.subClaims.map((sc) => `- ${sc.id}: ${sc.claimText}`).join("\n")}

EVIDENCE SUMMARY:
${evidenceSummary || "(none)"}

SYNTHESIS SUMMARY:
${synthesisSummary || "(none)"}

CONNECTIONS FOUND:
${connectionSummary || "(none)"}

Evaluate these three criteria:
1. NOVELTY: Did this round produce new entities or connections not seen in prior rounds?
2. COVERAGE: Does every sub-claim have at least some evidence?
3. OPPORTUNITY: Are there unqueried knowledge bases or Exa searches that might yield productive evidence?

Return your decision as JSON with these exact fields:
- "decision": "CONTINUE", "STOP_COMPLETE", or "STOP_WITH_GAPS"
- "reasoning": 2-3 sentences explaining your decision
- "suggestedQueries": array of suggested queries (only if decision is CONTINUE). Each query has "type" ("sql" or "exa"), "subClaimId", and either "sql"+"kbName"+"description" for SQL or "query" for Exa.

Respond with JSON containing "decision", "reasoning", and "suggestedQueries".`;

    context.emitReasoning?.(`Auditing investigation state (round ${input.round}/${input.maxRounds})...\n`);

    const rawResult = await context.llmClient.completeStructured(prompt, rawOutputSchema);
    const result = normalizeAuditorResult(rawResult);

    context.emitReasoning?.(`Auditor decision: ${result.decision}\n`);
    context.emitReasoning?.(`Reasoning: ${result.reasoning}\n`);
    if (result.suggestedQueries.length > 0) {
      context.emitReasoning?.(`Suggested ${result.suggestedQueries.length} follow-up queries.\n`);
    }

    return result;
  },
};
