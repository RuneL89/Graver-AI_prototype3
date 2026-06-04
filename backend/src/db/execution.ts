import type Database from "better-sqlite3";
import type { ProfilingQuery, ProfilingResult } from "@graver-ai/shared";

export function executeProfilingQueries(
  db: Database.Database,
  tableName: string,
  queries: ProfilingQuery[]
): ProfilingResult[] {
  const results: ProfilingResult[] = [];

  for (const query of queries) {
    try {
      // Safety: only allow SELECT statements on the target table
      const normalized = query.sql.trim().toLowerCase();
      if (!normalized.startsWith("select ")) {
        results.push({
          query,
          result: [{ error: "Only SELECT queries are allowed" }],
        });
        continue;
      }

      const stmt = db.prepare(query.sql);
      const rows = stmt.all() as unknown[];
      results.push({ query, result: rows });
    } catch (err: any) {
      results.push({
        query,
        result: [{ error: err.message }],
      });
    }
  }

  return results;
}
