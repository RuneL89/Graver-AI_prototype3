import { z } from "zod";
import type { AgentSkill, AgentContext } from "@graver-ai/shared";

const inputSchema = z.object({
  auditDecision: z.enum(["CONTINUE", "STOP_COMPLETE", "STOP_WITH_GAPS"]),
  auditReasoning: z.string(),
  synthesis: z.array(z.object({
    subClaimId: z.string(),
    narrative: z.string(),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    contradictions: z.array(z.string()),
  })),
  subClaims: z.array(z.object({
    id: z.string(),
    claimText: z.string(),
    targetEntityType: z.string(),
  })),
  tip: z.string(),
});

// Lenient raw schema
const rawOutputSchema = z.object({
  suggestions: z.array(z.string()).optional(),
  gapSuggestions: z.array(z.string()).optional(),
  gaps: z.array(z.string()).optional(),
  missingData: z.array(z.string()).optional(),
});

const outputSchema = z.object({
  suggestions: z.array(z.string()),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

function normalizeSuggestions(raw: z.infer<typeof rawOutputSchema>): Output {
  const suggestions = raw.suggestions || raw.gapSuggestions || raw.gaps || raw.missingData || [];
  return { suggestions };
}

export const gapDiscoverySkill: AgentSkill<Input, Output> = {
  name: "gapDiscovery",
  description:
    "Suggests what data is missing, what type of knowledge base would contain it, and what public sources might exist.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    // Only run if there are actual gaps
    if (input.auditDecision !== "STOP_WITH_GAPS") {
      context.emitReasoning?.("No gaps identified — skipping gap discovery.\n");
      return { suggestions: [] };
    }

    const synthesisSummary = input.synthesis.map((s) =>
      `- ${s.subClaimId} (${s.confidence}): ${s.narrative.slice(0, 120)}...`
    ).join("\n");

    const prompt = `You are a gap discovery specialist. The investigation has stopped with gaps. Suggest what data is missing and where it might be found.

TIP BEING INVESTIGATED:
"""${input.tip}"""

AUDITOR REASONING:
${input.auditReasoning}

SUB-CLAIMS:
${input.subClaims.map((sc) => `- ${sc.id}: ${sc.claimText}`).join("\n")}

CURRENT SYNTHESIS:
${synthesisSummary || "(none)"}

For each gap, suggest:
1. What specific data is missing
2. What type of knowledge base or dataset would contain it
3. What public sources might exist (government databases, news archives, NGO reports, etc.)
4. A recommendation to acquire and ingest such a dataset

Return JSON with a "suggestions" array of strings. Each string should be a complete, actionable suggestion paragraph.`;

    context.emitReasoning?.("Discovering gap suggestions...\n");

    const rawResult = await context.llmClient.completeStructured(prompt, rawOutputSchema);
    const result = normalizeSuggestions(rawResult);

    for (const s of result.suggestions) {
      context.emitReasoning?.(`  → ${s.slice(0, 120)}...\n`);
    }

    return result;
  },
};
