import { z } from "zod";
import type { AgentSkill, AgentContext, Query } from "@graver-ai/shared";

const inputSchema = z.object({
  subClaim: z.object({
    id: z.string(),
    claimText: z.string(),
    researchQuestion: z.string(),
    targetEntityType: z.string(),
  }),
  kbAssignments: z.array(z.object({
    kbName: z.string(),
    sourceType: z.enum(["sqlite", "exa"]),
    relevanceScore: z.number(),
    justification: z.string(),
  })),
  kbSchemas: z.array(z.object({
    kbName: z.string(),
    tableName: z.string(),
    columns: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })),
  })).optional(),
});

const outputSchema = z.object({
  queries: z.array(z.union([
    z.object({
      type: z.literal("sql"),
      subClaimId: z.string(),
      kbName: z.string(),
      description: z.string(),
      sql: z.string(),
    }),
    z.object({
      type: z.literal("exa"),
      subClaimId: z.string(),
      query: z.string(),
      numResults: z.number().optional(),
      includeDomains: z.array(z.string()).optional(),
      excludeDomains: z.array(z.string()).optional(),
      startPublishedDate: z.string().optional(),
      endPublishedDate: z.string().optional(),
      category: z.string().optional(),
    }),
  ])),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export const queryGeneratorSkill: AgentSkill<Input, Output> = {
  name: "queryGenerator",
  description:
    "Generates precise queries for a sub-claim: SQL for SQLite KBs, or search parameters for Exa.ai web research.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    const schemaInfo = input.kbSchemas
      ?.map((s) => `KB: ${s.kbName}\nTable: ${s.tableName}\nColumns: ${s.columns.map((c) => `${c.name} (${c.type})`).join(", ")}`)
      .join("\n\n---\n\n") ?? "(no schema info available)";

    const prompt = `You are a query generation specialist. Given a research sub-claim and assigned knowledge bases, generate precise queries.

SUB-CLAIM:
ID: ${input.subClaim.id}
Research Question: ${input.subClaim.researchQuestion}
Claim: ${input.subClaim.claimText}
Target Entity Type: ${input.subClaim.targetEntityType}

ASSIGNED KNOWLEDGE BASES:
${input.kbAssignments.map((a) => `- ${a.kbName} (${a.sourceType}, relevance: ${Math.round(a.relevanceScore * 100)}%)`).join("\n")}

DATABASE SCHEMAS:
${schemaInfo}

Generate queries for each assigned knowledge base:

For SQLite KBs:
- Write valid SQLite SELECT queries
- Use JOINs, filters, aggregations as needed
- Target the specific table in each KB (table name usually matches kb_name with "kb_" prefix)
- Limit results to at most 100 rows per query
- Include descriptive comments

For Exa.ai (web search):
- Write a semantic search query string (natural language, not SQL)
- Set numResults (5-10)
- Optionally set date range, domain filters, or category
- The query should be specific and targeted

Respond with JSON containing a "queries" array. Each query must have a "type" field ("sql" or "exa") and the relevant fields for that type.`;

    context.emitReasoning?.(`Generating queries for sub-claim: ${input.subClaim.researchQuestion}\n`);

    const result = await context.llmClient.completeStructured(prompt, outputSchema);

    for (const q of result.queries) {
      if (q.type === "sql") {
        context.emitReasoning?.(`  → SQL for ${q.kbName}: ${q.description}\n`);
      } else {
        context.emitReasoning?.(`  → Exa search: ${q.query}\n`);
      }
    }

    return result;
  },
};
