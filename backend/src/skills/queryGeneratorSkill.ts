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
    sampleRows: z.array(z.record(z.any())).optional(),
  })).optional(),
});

// Lenient raw schema that accepts common LLM field name variations
const rawSqlQuerySchema = z.object({
  type: z.literal("sql"),
  subClaimId: z.string().optional(),
  sub_claim_id: z.string().optional(),
  kbName: z.string().optional(),
  kb_name: z.string().optional(),
  description: z.string().optional(),
  desc: z.string().optional(),
  sql: z.string().optional(),
  query: z.string().optional(),
});

const rawExaQuerySchema = z.object({
  type: z.literal("exa"),
  subClaimId: z.string().optional(),
  sub_claim_id: z.string().optional(),
  query: z.string().optional(),
  searchQuery: z.string().optional(),
  numResults: z.number().optional(),
  num_results: z.number().optional(),
  includeDomains: z.array(z.string()).optional(),
  include_domains: z.array(z.string()).optional(),
  excludeDomains: z.array(z.string()).optional(),
  exclude_domains: z.array(z.string()).optional(),
  startPublishedDate: z.string().optional(),
  start_published_date: z.string().optional(),
  endPublishedDate: z.string().optional(),
  end_published_date: z.string().optional(),
  category: z.string().optional(),
});

const rawOutputSchema = z.object({
  queries: z.array(z.union([rawSqlQuerySchema, rawExaQuerySchema])),
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

function normalizeQueries(raw: z.infer<typeof rawOutputSchema>, fallbackSubClaimId: string): Output {
  const queries: Query[] = [];

  for (const q of raw.queries) {
    if (q.type === "sql") {
      const sql = q.sql || q.query;
      if (!sql) continue;
      queries.push({
        type: "sql",
        subClaimId: q.subClaimId || q.sub_claim_id || fallbackSubClaimId,
        kbName: q.kbName || q.kb_name || "unknown",
        description: q.description || q.desc || "SQL query",
        sql,
      });
    } else {
      const searchQuery = q.query || q.searchQuery;
      if (!searchQuery) continue;
      queries.push({
        type: "exa",
        subClaimId: q.subClaimId || q.sub_claim_id || fallbackSubClaimId,
        query: searchQuery,
        numResults: q.numResults ?? q.num_results,
        includeDomains: q.includeDomains ?? q.include_domains,
        excludeDomains: q.excludeDomains ?? q.exclude_domains,
        startPublishedDate: q.startPublishedDate ?? q.start_published_date,
        endPublishedDate: q.endPublishedDate ?? q.end_published_date,
        category: q.category,
      });
    }
  }

  return { queries };
}

export const queryGeneratorSkill: AgentSkill<Input, Output> = {
  name: "queryGenerator",
  description:
    "Generates precise queries for a sub-claim: SQL for SQLite KBs, or search parameters for Exa.ai web research.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    const schemaInfo = input.kbSchemas
      ?.map((s) => {
        let info = `KB: ${s.kbName}\nTable: ${s.tableName}\nColumns: ${s.columns.map((c) => `${c.name} (${c.type})`).join(", ")}`;
        if (s.sampleRows && s.sampleRows.length > 0) {
          info += `\nSample rows:\n${JSON.stringify(s.sampleRows, null, 2)}`;
        }
        return info;
      })
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

For SQLite KBs, return a JSON object with these exact fields:
- "type": "sql"
- "subClaimId": "${input.subClaim.id}"
- "kbName": the knowledge base name
- "description": brief description of what the query does
- "sql": the full SQLite SELECT query string

For Exa.ai (web search), return a JSON object with these exact fields:
- "type": "exa"
- "subClaimId": "${input.subClaim.id}"
- "query": the semantic search query string (natural language)
- "numResults": number of results to request (5-10)
- optionally: "includeDomains", "excludeDomains", "startPublishedDate", "endPublishedDate", "category"

Respond with JSON containing a "queries" array.`;

    context.emitReasoning?.(`Generating queries for sub-claim: ${input.subClaim.researchQuestion}\n`);

    const rawResult = await context.llmClient.completeStructured(prompt, rawOutputSchema);
    const result = normalizeQueries(rawResult, input.subClaim.id);

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
