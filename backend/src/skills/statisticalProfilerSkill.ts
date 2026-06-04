import { z } from "zod";
import type { AgentSkill, AgentContext, TableSchema, ProfilingQuery } from "@graver-ai/shared";

const inputSchema = z.object({
  schema: z.any(), // TableSchema
});

const outputSchema = z.object({
  queries: z.array(
    z.object({
      description: z.string(),
      sql: z.string(),
    })
  ),
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export const statisticalProfilerSkill: AgentSkill<Input, Output> = {
  name: "statisticalProfiler",
  description:
    "Given a table schema and sample rows, proposes SQL profiling queries to understand the data landscape.",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    const schema = input.schema as TableSchema;

    const columnList = schema.columns
      .map((c) => `- ${c.name} (${c.type})${c.nullable ? " nullable" : ""}`)
      .join("\n");

    const sampleRowsJson = JSON.stringify(schema.sampleRows.slice(0, 10), null, 2);

    const prompt = `You are a data profiling assistant for large-scale SQLite datasets. Given the following table schema and sample rows, propose 5-8 lightweight SQL SELECT queries that will efficiently measure the data landscape.

Table: ${schema.tableName}
Row count: ${schema.rowCount}
Columns:
${columnList}

Foreign key columns detected: ${schema.foreignKeys.join(", ") || "none"}

Sample rows (up to 10):
${sampleRowsJson}

Performance requirements:
- This table has ${schema.rowCount} rows. Every query MUST be designed to complete in seconds, not minutes.
- Prefer O(n) single-pass aggregates. Avoid any operation that requires sorting, hashing, or materializing large intermediate results.
- NEVER use ORDER BY — sorting unindexed large tables is prohibitively expensive.
- NEVER use SELECT * — always SELECT specific columns.
- NEVER use SELECT DISTINCT without an aggregate wrapper (e.g., use COUNT(DISTINCT column), not SELECT DISTINCT column).
- Avoid GROUP BY on high-cardinality columns (e.g., unique IDs, timestamps). If you need a distribution, prefer COUNT(DISTINCT ...) or a sampled subquery.
- Do not use CTEs or subqueries unless absolutely necessary.

Generate queries that measure:
1. Cardinality: COUNT(DISTINCT column) for key columns
2. Null rates: percentage of NULLs per column
3. Numerical ranges: MIN, MAX, AVG for numeric columns
4. Temporal bounds: MIN(date_col), MAX(date_col) for date columns
5. Low-cardinality frequencies: GROUP BY only on columns with few unique values (status codes, categories, flags). Skip if no such columns exist.
6. Row-level sanity checks: COUNT(*) with simple WHERE filters (e.g., invalid dates, negative values)

Important constraints:
- All queries must be valid SQLite SELECT statements
- Use only the table name "${schema.tableName}"
- Keep queries simple and focused
- Each query should return at most 100 rows of aggregated data

Respond with a JSON object containing a "queries" array. Each item must have "description" and "sql" fields.`;

    const result = await context.llmClient.completeStructured(prompt, outputSchema);
    return result;
  },
};
