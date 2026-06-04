import { z } from "zod";
import type { AgentSkill, AgentContext, ProfilingResult, WikiPlan } from "@graver-ai/shared";
import { readPage, listPages } from "../wiki/store.js";

const inputSchema = z.object({
  schema: z.any(),
  profilingResults: z.array(z.any()),
  targetKb: z.string().optional(),
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

export const wikiArchitectSkill: AgentSkill<Input, Output> = {
  name: "wikiArchitect",
  description:
    "Given statistical profiling results, drafts a wiki structure plan with index.md and proposed entity pages.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    const schema = input.schema;
    const profilingResults = input.profilingResults as ProfilingResult[];

    // Read existing wiki if updating
    let existingContext = "";
    if (input.targetKb) {
      try {
        const existingPages = await listPages(input.targetKb);
        const existingIndex = await readPage(input.targetKb, "index.md");
        existingContext = `\n\nEXISTING WIKI CONTEXT:\nTarget KB: ${input.targetKb}\nExisting pages: ${existingPages.join(", ")}\n\nExisting index.md:\n${existingIndex || "(none)"}\n\nYour task is to PROPOSE NEW PAGES and UPDATE the index.md to incorporate both existing and new content. Reference existing pages where relevant.`;
      } catch {
        // ignore if existing wiki can't be read
      }
    }

    const resultsSummary = profilingResults
      .map((pr) => {
        const resultPreview =
          pr.result.length > 0
            ? JSON.stringify(pr.result.slice(0, 5), null, 2)
            : "(no results)";
        return `Query: ${pr.query.description}\nSQL: ${pr.query.sql}\nResults preview:\n${resultPreview}`;
      })
      .join("\n\n---\n\n");

    const prompt = `You are a wiki architect. Given the following database table schema and statistical profiling results, design a markdown wiki structure plan.${existingContext}

Table: ${schema.tableName}
Columns: ${schema.columns.map((c: any) => `${c.name} (${c.type})`).join(", ")}
Row count: ${schema.rowCount}

Profiling Results:
${resultsSummary}

Your task:
1. Draft an index.md content that describes what this knowledge base contains, what questions it can answer, and what segments/entities exist.${input.targetKb ? " Incorporate and reference existing pages." : ""}
2. Propose 3-6 additional wiki pages (entity pages, segment pages, or topical pages) based on statistically notable patterns in the data.
3. Suggest cross-knowledge-base linkage hints (e.g., "this table has CVR numbers that could link to company registries").

Respond with JSON containing:
- "indexContent": the full markdown content for index.md
- "proposedPages": array of {path, title, rationale}
- "linkageHints": array of strings`;

    const result = await context.llmClient.completeStructured(prompt, outputSchema);
    return result;
  },
};
