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

    const prompt = `You are a data profiling assistant. Given the following SQLite table schema and sample rows, propose 5-8 SQL SELECT queries that will help understand the data landscape.

Table: ${schema.tableName}
Columns:
${columnList}

Foreign key columns detected: ${schema.foreignKeys.join(", ") || "none"}

Sample rows (up to 10):
${sampleRowsJson}

Generate queries that explore:
1. Frequency distributions of categorical columns
2. Numerical outliers and ranges
3. Null rates per column
4. Temporal patterns (if date columns exist)
5. Cross-column correlations or co-occurrences
6. Cardinality of key columns

Important constraints:
- All queries must be valid SQLite SELECT statements
- Use only the table name "${schema.tableName}"
- Do not use CTEs or subqueries unless necessary
- Keep queries simple and focused

Respond with a JSON object containing a "queries" array. Each item must have "description" and "sql" fields.`;

    const result = await context.llmClient.completeStructured(prompt, outputSchema);
    return result;
  },
};
