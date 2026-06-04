import { z } from "zod";
import type { AgentSkill, AgentContext, EvidenceBundle, ConnectionFinding, Synthesis } from "@graver-ai/shared";

const inputSchema = z.object({
  evidence: z.array(z.object({
    subClaimId: z.string(),
    sourceType: z.enum(["sqlite", "exa"]),
    query: z.string(),
    results: z.array(z.unknown()),
    timestamp: z.string(),
  })),
  connections: z.array(z.object({
    entityIdentifier: z.string(),
    sources: z.array(z.string()),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    notes: z.string(),
  })),
  subClaims: z.array(z.object({
    id: z.string(),
    claimText: z.string(),
    targetEntityType: z.string(),
  })),
  tip: z.string(),
});

// Lenient raw schema
const rawSynthesisSchema = z.object({
  subClaimId: z.string().optional(),
  sub_claim_id: z.string().optional(),
  narrative: z.string().optional(),
  summary: z.string().optional(),
  text: z.string().optional(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  confidenceLevel: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  contradictions: z.array(z.string()).optional(),
  contradiction: z.array(z.string()).optional(),
});

const rawOutputSchema = z.object({
  entries: z.array(rawSynthesisSchema).optional(),
  synthesis: z.array(rawSynthesisSchema).optional(),
});

const outputSchema = z.object({
  entries: z.array(z.object({
    subClaimId: z.string(),
    narrative: z.string(),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    contradictions: z.array(z.string()),
  })),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

function normalizeSynthesis(raw: z.infer<typeof rawOutputSchema>, subClaims: { id: string; claimText: string }[]): Output {
  const rawEntries = raw.entries || raw.synthesis || [];
  const entries: Synthesis[] = [];

  for (const e of rawEntries) {
    const subClaimId = e.subClaimId || e.sub_claim_id;
    if (!subClaimId) continue;
    entries.push({
      subClaimId,
      narrative: e.narrative || e.summary || e.text || "(no narrative provided)",
      confidence: e.confidence || e.confidenceLevel || "MEDIUM",
      contradictions: e.contradictions || e.contradiction || [],
    });
  }

  // Ensure every sub-claim has a synthesis entry
  for (const sc of subClaims) {
    if (!entries.find((e) => e.subClaimId === sc.id)) {
      entries.push({
        subClaimId: sc.id,
        narrative: "No evidence was found for this sub-claim.",
        confidence: "LOW",
        contradictions: [],
      });
    }
  }

  return { entries };
}

export const evidenceSynthesizerSkill: AgentSkill<Input, Output> = {
  name: "evidenceSynthesizer",
  description:
    "Assembles evidence into narrative summaries per sub-claim, assigning confidence ratings and flagging contradictions.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    const evidenceBySubClaim = new Map<string, EvidenceBundle[]>();
    for (const e of input.evidence) {
      const list = evidenceBySubClaim.get(e.subClaimId) || [];
      list.push(e as EvidenceBundle);
      evidenceBySubClaim.set(e.subClaimId, list);
    }

    const evidenceSummaries = input.subClaims.map((sc) => {
      const bundles = evidenceBySubClaim.get(sc.id) || [];
      const bundleTexts = bundles.map((b) => {
        const preview = JSON.stringify(b.results).slice(0, 600);
        return `- ${b.sourceType}: ${b.query}\n  Results: ${preview}`;
      }).join("\n");
      return `SUB-CLAIM ${sc.id}: ${sc.claimText}\nEvidence:\n${bundleTexts || "(none)"}\n`;
    }).join("\n---\n");

    const connectionSummary = input.connections.map((c) =>
      `- ${c.entityIdentifier} (${c.confidence}): ${c.notes} [sources: ${c.sources.join(", ")}]`
    ).join("\n");

    const prompt = `You are an evidence synthesis specialist. Given evidence from multiple sources and cross-source connections, assemble a narrative summary per sub-claim.

TIP BEING INVESTIGATED:
"""${input.tip}"""

SUB-CLAIMS AND THEIR EVIDENCE:
${evidenceSummaries}

CROSS-SOURCE CONNECTIONS:
${connectionSummary || "(none)"}

For each sub-claim, produce a synthesis entry with these exact fields:
- "subClaimId": the sub-claim ID
- "narrative": a concise narrative summary of what the evidence shows (2-4 sentences)
- "confidence": "HIGH" (direct evidence from multiple sources), "MEDIUM" (inferred connections), or "LOW" (single source or circumstantial)
- "contradictions": array of strings describing any contradictions for this sub-claim

Respond with JSON containing an "entries" array.`;

    context.emitReasoning?.("Synthesizing evidence into narratives...\n");

    const rawResult = await context.llmClient.completeStructured(prompt, rawOutputSchema);
    const result = normalizeSynthesis(rawResult, input.subClaims);

    for (const e of result.entries) {
      context.emitReasoning?.(`  → ${e.subClaimId}: ${e.confidence} confidence — ${e.narrative.slice(0, 100)}...\n`);
    }

    return result;
  },
};
