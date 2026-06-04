import { z } from "zod";
import type { AgentSkill, AgentContext } from "@graver-ai/shared";

const inputSchema = z.object({
  subClaim: z.object({
    id: z.string(),
    claimText: z.string(),
    researchQuestion: z.string(),
    targetEntityType: z.string(),
    suggestedKbs: z.array(z.string()),
  }),
  kbIndexes: z.array(z.object({
    kbName: z.string(),
    indexContent: z.string(),
  })),
});

// Lenient raw schema that accepts common LLM field name variations
const rawOutputSchema = z.object({
  assignments: z.array(z.object({
    kbName: z.string().optional(),
    kb_name: z.string().optional(),
    name: z.string().optional(),
    sourceType: z.enum(["sqlite", "exa"]).optional(),
    source_type: z.enum(["sqlite", "exa"]).optional(),
    type: z.enum(["sqlite", "exa"]).optional(),
    relevanceScore: z.number().min(0).max(1).optional(),
    relevance_score: z.number().min(0).max(1).optional(),
    score: z.number().min(0).max(1).optional(),
    justification: z.string().optional(),
    reason: z.string().optional(),
  })),
});

const outputSchema = z.object({
  assignments: z.array(z.object({
    kbName: z.string(),
    sourceType: z.enum(["sqlite", "exa"]),
    relevanceScore: z.number().min(0).max(1),
    justification: z.string(),
  })),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

function normalizeAssignments(raw: z.infer<typeof rawOutputSchema>): Output {
  const assignments = raw.assignments.map((a) => ({
    kbName: a.kbName || a.kb_name || a.name || "unknown",
    sourceType: a.sourceType || a.source_type || a.type || "sqlite",
    relevanceScore: a.relevanceScore ?? a.relevance_score ?? a.score ?? 0.5,
    justification: a.justification || a.reason || "(no justification provided)",
  }));
  return { assignments };
}

export const kbNavigatorSkill: AgentSkill<Input, Output> = {
  name: "kbNavigator",
  description:
    "Matches a sub-claim to the most relevant knowledge bases, returning ranked assignments with relevance scores and justifications.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    const kbSummaries = input.kbIndexes
      .map((kb) => `KB: ${kb.kbName}\n${kb.indexContent.slice(0, 1500)}`)
      .join("\n\n---\n\n");

    const prompt = `You are a knowledge base navigator. Given a research sub-claim and available knowledge base indexes, decide which knowledge bases are most relevant.

SUB-CLAIM:
ID: ${input.subClaim.id}
Text: ${input.subClaim.claimText}
Research Question: ${input.subClaim.researchQuestion}
Target Entity Type: ${input.subClaim.targetEntityType}
Suggested KBs: ${input.subClaim.suggestedKbs.join(", ") || "none specified"}

AVAILABLE KNOWLEDGE BASES:
${kbSummaries || "(none available)"}

Also consider Exa.ai (web search) as a potential source, especially for:
- Recent events not in local databases
- News, company websites, public records
- Cross-referencing local findings

For each relevant knowledge base (including Exa.ai), return a JSON object with these exact fields:
- "kbName": the exact name from the available KBs, or "exa" for web search
- "sourceType": "sqlite" for local databases, "exa" for web search
- "relevanceScore": a number from 0.0 to 1.0
- "justification": one sentence explaining why this KB is relevant

Only include knowledge bases with relevanceScore >= 0.3. Return at most 5 assignments, ranked by relevance.

Respond with JSON containing an "assignments" array.`;

    context.emitReasoning?.(`Navigating KBs for sub-claim: ${input.subClaim.claimText}\n`);

    const rawResult = await context.llmClient.completeStructured(prompt, rawOutputSchema);
    const result = normalizeAssignments(rawResult);

    for (const a of result.assignments) {
      context.emitReasoning?.(`  → ${a.kbName} (${a.sourceType}): ${Math.round(a.relevanceScore * 100)}% — ${a.justification}\n`);
    }

    return result;
  },
};
