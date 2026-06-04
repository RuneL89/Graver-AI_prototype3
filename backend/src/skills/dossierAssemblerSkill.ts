import { z } from "zod";
import type { AgentSkill, AgentContext, Dossier, Synthesis, ConnectionFinding, EvidenceBundle, SourceAttribution } from "@graver-ai/shared";

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
  auditDecision: z.enum(["CONTINUE", "STOP_COMPLETE", "STOP_WITH_GAPS"]).optional(),
  auditReasoning: z.string().optional(),
  tip: z.string(),
  round: z.number(),
  gapSuggestions: z.array(z.string()).optional(),
});

// Lenient raw schema
const rawSourceAttributionSchema = z.object({
  claim: z.string().optional(),
  claimText: z.string().optional(),
  sourceType: z.enum(["sqlite", "exa"]).optional(),
  type: z.enum(["sqlite", "exa"]).optional(),
  sourceDetail: z.string().optional(),
  detail: z.string().optional(),
  query: z.string().optional(),
});

const rawOutputSchema = z.object({
  executiveSummary: z.string().optional(),
  summary: z.string().optional(),
  findings: z.array(z.object({
    subClaimId: z.string().optional(),
    sub_claim_id: z.string().optional(),
    narrative: z.string().optional(),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    contradictions: z.array(z.string()).optional(),
  })).optional(),
  connections: z.array(z.object({
    entityIdentifier: z.string().optional(),
    entity: z.string().optional(),
    identifier: z.string().optional(),
    sources: z.array(z.string()).optional(),
    source: z.array(z.string()).optional(),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    notes: z.string().optional(),
    note: z.string().optional(),
  })).optional(),
  gaps: z.array(z.string()).optional(),
  evidenceGaps: z.array(z.string()).optional(),
  overallConfidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  sourceAttribution: z.array(rawSourceAttributionSchema).optional(),
  sources: z.array(rawSourceAttributionSchema).optional(),
  suggestedNextSteps: z.array(z.string()).optional(),
  nextSteps: z.array(z.string()).optional(),
});

const outputSchema = z.object({
  executiveSummary: z.string(),
  findings: z.array(z.object({
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
  gaps: z.array(z.string()),
  overallConfidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  sourceAttribution: z.array(z.object({
    claim: z.string(),
    sourceType: z.enum(["sqlite", "exa"]),
    sourceDetail: z.string(),
  })),
  suggestedNextSteps: z.array(z.string()),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

function normalizeDossier(raw: z.infer<typeof rawOutputSchema>, inputSynthesis: Synthesis[]): Dossier {
  const executiveSummary = raw.executiveSummary || raw.summary || "No executive summary provided.";

  const findings: Synthesis[] = (raw.findings || []).map((f) => ({
    subClaimId: f.subClaimId || f.sub_claim_id || "unknown",
    narrative: f.narrative || "(no narrative)",
    confidence: f.confidence || "MEDIUM",
    contradictions: f.contradictions || [],
  }));

  // Fallback to input synthesis if no findings provided
  const finalFindings = findings.length > 0 ? findings : inputSynthesis;

  const connections: ConnectionFinding[] = (raw.connections || []).map((c) => ({
    entityIdentifier: c.entityIdentifier || c.entity || c.identifier || "unknown",
    sources: c.sources || c.source || [],
    confidence: c.confidence || "MEDIUM",
    notes: c.notes || c.note || "",
  }));

  const gaps = raw.gaps || raw.evidenceGaps || [];
  const overallConfidence = raw.overallConfidence || raw.confidence || "MEDIUM";

  const rawSources = raw.sourceAttribution || raw.sources || [];
  const sourceAttribution: SourceAttribution[] = rawSources.map((s) => ({
    claim: s.claim || s.claimText || "(unattributed)",
    sourceType: s.sourceType || s.type || "sqlite",
    sourceDetail: s.sourceDetail || s.detail || s.query || "(unknown source)",
  }));

  const suggestedNextSteps = raw.suggestedNextSteps || raw.nextSteps || [];

  return {
    executiveSummary,
    findings: finalFindings,
    connections,
    gaps,
    overallConfidence,
    sourceAttribution,
    suggestedNextSteps,
  };
}

export const dossierAssemblerSkill: AgentSkill<Input, Output> = {
  name: "dossierAssembler",
  description:
    "Formats a structured investigation dossier with executive summary, findings, connections, gaps, confidence summary, source attribution, and suggested next steps.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    const synthesisSummary = input.synthesis.map((s) =>
      `Sub-Claim ${s.subClaimId} (${s.confidence}): ${s.narrative}\nContradictions: ${s.contradictions.join(", ") || "none"}`
    ).join("\n\n");

    const connectionSummary = input.connections.map((c) =>
      `- ${c.entityIdentifier} (${c.confidence}): ${c.notes} [${c.sources.join(", ")}]`
    ).join("\n");

    const evidenceSummary = input.evidence.map((e) =>
      `- ${e.sourceType}: ${e.query} (${e.results.length} results)`
    ).join("\n");

    const gapText = input.gapSuggestions && input.gapSuggestions.length > 0
      ? `\n\nGAP SUGGESTIONS FROM AUDITOR:\n${input.gapSuggestions.join("\n")}`
      : "";

    const prompt = `You are a dossier assembler. Format the investigation results into a structured dossier.

TIP BEING INVESTIGATED:
"""${input.tip}"""

INVESTIGATION ROUNDS COMPLETED: ${input.round}
AUDITOR DECISION: ${input.auditDecision || "STOP"}
AUDITOR REASONING: ${input.auditReasoning || "(none)"}

SYNTHESIS BY SUB-CLAIM:
${synthesisSummary}

CROSS-SOURCE CONNECTIONS:
${connectionSummary || "(none)"}

EVIDENCE SUMMARY:
${evidenceSummary || "(none)"}
${gapText}

Format a structured dossier with these sections. Return JSON with these exact fields:
- "executiveSummary": 2-3 paragraph executive summary of the investigation
- "findings": array of finding objects, one per sub-claim, each with "subClaimId", "narrative", "confidence", "contradictions"
- "connections": array of connection objects with "entityIdentifier", "sources", "confidence", "notes"
- "gaps": array of strings describing evidence gaps
- "overallConfidence": "HIGH", "MEDIUM", or "LOW" for the entire investigation
- "sourceAttribution": array of objects with "claim", "sourceType" ("sqlite" or "exa"), "sourceDetail" (query or search string)
- "suggestedNextSteps": array of strings with actionable next steps for human follow-up

Respond with JSON containing all fields.`;

    context.emitReasoning?.("Assembling final investigation dossier...\n");

    const rawResult = await context.llmClient.completeStructured(prompt, rawOutputSchema);
    const result = normalizeDossier(rawResult, input.synthesis as Synthesis[]);

    context.emitReasoning?.(`Dossier assembled: ${result.findings.length} findings, ${result.connections.length} connections, ${result.gaps.length} gaps.\n`);
    context.emitReasoning?.(`Overall confidence: ${result.overallConfidence}\n`);

    return result;
  },
};
