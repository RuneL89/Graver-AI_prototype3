import { z } from "zod";
import type { AgentSkill, AgentContext, WikiPlan, ProfilingResult } from "@graver-ai/shared";
import { readPage } from "../wiki/store.js";

const inputSchema = z.object({
  tableName: z.string(),
  plan: z.any(),
  profilingResults: z.array(z.any()),
  targetKb: z.string().optional(),
});

const outputSchema = z.object({
  pages: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    })
  ),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export const wikiWriterSkill: AgentSkill<Input, Output> = {
  name: "wikiWriter",
  description:
    "Generates polished markdown wiki pages from an approved plan and statistical results.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    const { tableName, plan, profilingResults, targetKb } = input;

    const profilingSummary = (profilingResults as ProfilingResult[])
      .map((pr) => `## ${pr.query.description}\n\`\`\`sql\n${pr.query.sql}\n\`\`\`\nResults: ${JSON.stringify(pr.result.slice(0, 10))}`)
      .join("\n\n");

    let existingIndex = "";
    if (targetKb) {
      existingIndex = (await readPage(targetKb, "index.md")) || "";
    }

    const mergeInstruction = existingIndex
      ? `\n\nIMPORTANT: This wiki already exists. The existing index.md is:\n\n---\n${existingIndex}\n---\n\nYour task is to produce a MERGED index.md that incorporates BOTH the existing content AND the new content from this plan. Do not simply append — synthesize a coherent, unified index.`
      : "";

    const prompt = `You are a wiki writer. Generate polished markdown pages for a knowledge base based on the approved plan below.

Database table: ${tableName}

Approved Plan:
- Index content length: ${plan.indexContent.length} characters
- Proposed pages: ${plan.proposedPages.map((p: any) => p.title).join(", ")}
- Linkage hints: ${plan.linkageHints.join("; ")}

Statistical results summary:
${profilingSummary}${mergeInstruction}

Generate the following pages as JSON with a "pages" array. Each page has "path" (relative to kb root) and "content" (full markdown).

Required pages:
1. index.md - The main index page, incorporating the approved plan's indexContent, expanded with proper headers, wikilinks to other pages, and citation anchors referencing the database table ${tableName}.${existingIndex ? " This MUST be a merged version that unifies old and new content." : ""}
${plan.proposedPages
  .map((p: any, i: number) => `${i + 2}. ${p.path} - ${p.title}. ${p.rationale}`)
  .join("\n")}

Guidelines:
- Use proper markdown headers (#, ##, ###)
- Create wikilinks like [[page-name]] between related pages
- Add citation anchors where data is referenced: [source: ${tableName}]
- Keep content factual and grounded in the statistical results
- Do not invent data not present in the results`;

    const result = await context.llmClient.completeStructured(prompt, outputSchema);
    return result;
  },
};
