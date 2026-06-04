import { z } from "zod";
import type { AgentSkill, AgentContext, WikiPlan, ProfilingResult, TableSchema } from "@graver-ai/shared";

const inputSchema = z.object({
  schema: z.any(),
  currentPlan: z.any(),
  profilingResults: z.array(z.any()),
  modificationPrompt: z.string(),
});

const outputSchema = z.object({
  indexContent: z.string(),
  proposedPages: z.array(
    z.object({
      path: z.string(),
      title: z.string(),
      rationale: z.string(),
    })
  ),
  linkageHints: z.array(z.string()),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export const wikiPlanModifierSkill: AgentSkill<Input, Output> = {
  name: "wikiPlanModifier",
  description:
    "Revises a wiki plan based on user feedback while preserving statistical grounding.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    const schema = input.schema as TableSchema;
    const currentPlan = input.currentPlan as WikiPlan;
    const profilingResults = input.profilingResults as ProfilingResult[];

    const resultsSummary = profilingResults
      .map((pr) => `Query: ${pr.query.description}\nResults: ${JSON.stringify(pr.result.slice(0, 5))}`)
      .join("\n\n");

    const prompt = `You are a wiki architect. A user has reviewed your initial wiki plan and requested changes. Revise the plan accordingly.

Database table: ${schema.tableName}
Row count: ${schema.rowCount}

Statistical results:
${resultsSummary}

Current plan:
--- index.md ---
${currentPlan.indexContent}

--- Proposed pages ---
${currentPlan.proposedPages.map((p) => `- ${p.path}: ${p.title}\n  Rationale: ${p.rationale}`).join("\n")}

--- Linkage hints ---
${currentPlan.linkageHints.join("\n") || "None"}

User modification request:
"""${input.modificationPrompt}"""

Revise the wiki plan according to the user's request. You may:
- Add, remove, or restructure pages
- Change the index.md content
- Add or modify linkage hints
- Merge this knowledge base with another (reference it by name if mentioned)
- Make pages more or less detailed

Respond with JSON containing:
- "indexContent": revised markdown for index.md
- "proposedPages": array of {path, title, rationale}
- "linkageHints": array of strings`;

    const result = await context.llmClient.completeStructured(prompt, outputSchema);
    return result;
  },
};
