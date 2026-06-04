import { z } from "zod";
import type { AgentSkill, AgentContext, ResearchPlan } from "@graver-ai/shared";

const inputSchema = z.object({
  tip: z.string().min(1),
  kbIndexes: z.array(z.object({
    kbName: z.string(),
    indexContent: z.string(),
  })),
});

const outputSchema = z.object({
  subClaims: z.array(z.object({
    id: z.string(),
    claimText: z.string(),
    researchQuestion: z.string(),
    targetEntityType: z.string(),
    suggestedKbs: z.array(z.string()),
  })),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export const tipDecomposerSkill: AgentSkill<Input, Output> = {
  name: "tipDecomposer",
  description:
    "Breaks an investigative tip into 3-5 independently researchable sub-claims, each with a focused research question, target entity type, and suggested knowledge bases.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    const kbSummaries = input.kbIndexes
      .map((kb) => `Knowledge Base: ${kb.kbName}\n${kb.indexContent.slice(0, 2000)}`)
      .join("\n\n---\n\n");

    const prompt = `You are an investigative research planner. Given the following tip and available knowledge bases, break the tip into 3-5 independently researchable sub-claims.

TIP:
"""${input.tip}"""

AVAILABLE KNOWLEDGE BASES (index summaries):
${kbSummaries || "(none available)"}

For each sub-claim, provide:
1. A unique ID (e.g., "sc-1", "sc-2")
2. The sub-claim text (a focused, verifiable statement)
3. A precise research question that could be answered with data
4. The target entity type (e.g., "company", "person", "shipment", "incident", "location")
5. A list of suggested knowledge base names that might contain relevant data (use the exact kbName values from above, or include "exa" for web research)

Important:
- Each sub-claim must be independently researchable
- Be specific about what entities to look for
- Consider both local SQLite databases and Exa.ai web search
- Do not assume domain knowledge beyond what's in the indexes

Respond with JSON containing a "subClaims" array.`;

    context.emitReasoning?.("Reading tip and available knowledge bases...\n");

    const result = await context.llmClient.completeStructured(prompt, outputSchema);

    context.emitReasoning?.(`Decomposed tip into ${result.subClaims.length} sub-claims:\n`);
    for (const sc of result.subClaims) {
      context.emitReasoning?.(`- ${sc.claimText} (entities: ${sc.targetEntityType})\n`);
    }

    return result;
  },
};
