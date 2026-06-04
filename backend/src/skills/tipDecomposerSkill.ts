import { z } from "zod";
import type { AgentSkill, AgentContext } from "@graver-ai/shared";

const inputSchema = z.object({
  tip: z.string().min(1),
  kbIndexes: z.array(z.object({
    kbName: z.string(),
    indexContent: z.string(),
  })),
});

// Lenient raw schema that accepts common LLM field name variations
const rawOutputSchema = z.object({
  subClaims: z.array(z.object({
    id: z.string(),
    claimText: z.string().optional(),
    claim: z.string().optional(),
    text: z.string().optional(),
    researchQuestion: z.string().optional(),
    question: z.string().optional(),
    targetEntityType: z.string().optional(),
    entityType: z.string().optional(),
    suggestedKbs: z.array(z.string()).optional(),
    suggested_kbs: z.array(z.string()).optional(),
    kbs: z.array(z.string()).optional(),
  })),
});

// Strict schema after normalization
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

function normalizeSubClaims(raw: z.infer<typeof rawOutputSchema>): Output {
  const subClaims = raw.subClaims.map((sc, idx) => ({
    id: sc.id || `sc-${idx + 1}`,
    claimText: sc.claimText || sc.claim || sc.text || "(no claim text provided)",
    researchQuestion: sc.researchQuestion || sc.question || sc.claimText || sc.claim || sc.text || "(no research question provided)",
    targetEntityType: sc.targetEntityType || sc.entityType || "unknown",
    suggestedKbs: sc.suggestedKbs || sc.suggested_kbs || sc.kbs || [],
  }));
  return { subClaims };
}

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

For each sub-claim, you MUST return a JSON object with these exact fields:
- "id": a unique ID string (e.g., "sc-1", "sc-2")
- "claimText": the sub-claim text (a focused, verifiable statement)
- "researchQuestion": a precise research question that could be answered with data
- "targetEntityType": the target entity type (e.g., "company", "person", "shipment", "incident", "location")
- "suggestedKbs": an array of suggested knowledge base names (use exact kbName values from above, or include "exa" for web research)

Important:
- Each sub-claim must be independently researchable
- Be specific about what entities to look for
- Consider both local SQLite databases and Exa.ai web search
- Do not assume domain knowledge beyond what's in the indexes

Respond with JSON containing a "subClaims" array.`;

    context.emitReasoning?.("Reading tip and available knowledge bases...\n");

    const rawResult = await context.llmClient.completeStructured(prompt, rawOutputSchema);
    const result = normalizeSubClaims(rawResult);

    context.emitReasoning?.(`Decomposed tip into ${result.subClaims.length} sub-claims:\n`);
    for (const sc of result.subClaims) {
      context.emitReasoning?.(`- ${sc.claimText} (entities: ${sc.targetEntityType})\n`);
    }

    return result;
  },
};
