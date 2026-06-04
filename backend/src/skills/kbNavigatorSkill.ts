import { z } from "zod";
import type { AgentSkill, AgentContext, KBAssignment } from "@graver-ai/shared";

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

For each relevant knowledge base (including Exa.ai), return:
- kbName: the exact name from the available KBs, or "exa" for web search
- sourceType: "sqlite" for local databases, "exa" for web search
- relevanceScore: 0.0 to 1.0
- justification: one sentence explaining why this KB is relevant

Only include knowledge bases with relevanceScore >= 0.3. Return at most 5 assignments, ranked by relevance.

Respond with JSON containing an "assignments" array.`;

    context.emitReasoning?.(`Navigating KBs for sub-claim: ${input.subClaim.claimText}\n`);

    const result = await context.llmClient.completeStructured(prompt, outputSchema);

    for (const a of result.assignments) {
      context.emitReasoning?.(`  → ${a.kbName} (${a.sourceType}): ${Math.round(a.relevanceScore * 100)}% — ${a.justification}\n`);
    }

    return result;
  },
};
