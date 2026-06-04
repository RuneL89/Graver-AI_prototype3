import type Database from "better-sqlite3";
import type { ProfilingQuery, ProfilingResult } from "@graver-ai/shared";

function addLimitIfMissing(sql: string, limit: number): string {
  const normalized = sql.trim().toLowerCase();
  // Don't add LIMIT if one already exists
  if (/\blimit\s+\d+/.test(normalized)) return sql;
  // Don't add LIMIT to COUNT(*) queries (SQLite optimizes these)
  if (/\bcount\s*\(\s*\*\s*\)/.test(normalized)) return sql;
  return `${sql.trim()} LIMIT ${limit}`;
}

export function executeProfilingQueries(
  db: Database.Database,
  tableName: string,
  queries: ProfilingQuery[],
  rowLimit = 1000
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

      const safeSql = addLimitIfMissing(query.sql, rowLimit);
      const stmt = db.prepare(safeSql);
      const rows = stmt.all() as unknown[];
      results.push({ query: { ...query, sql: safeSql }, result: rows });
    } catch (err: any) {
      results.push({
        query,
        result: [{ error: err.message }],
      });
    }
  }

  return results;
}
