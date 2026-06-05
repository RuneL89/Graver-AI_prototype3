import { getDb } from "../db/connection.js";
import { ExaClient } from "../exa/client.js";
import type { Query, EvidenceBundle, ExaSearchParams } from "@graver-ai/shared";

export interface QueryExecutorResult {
  evidence: EvidenceBundle[];
  errors: string[];
}

export interface QueryExecutedPayload {
  subClaimId: string;
  sourceType: "sqlite" | "exa";
  query: string;
  resultCount: number;
  durationMs?: number;
}

function resolveTableName(kbName: string): string {
  const db = getDb();
  // First, check if kbName is already a valid table
  const directCheck = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
  ).get(kbName);
  if (directCheck) return kbName;

  // Otherwise, try to map from wiki_name via ingestion_jobs
  const row = db.prepare(
    "SELECT schema_json FROM ingestion_jobs WHERE wiki_name = ?"
  ).get(kbName) as { schema_json: string } | undefined;

  if (row) {
    try {
      const schema = JSON.parse(row.schema_json) as { tableName?: string };
      if (schema.tableName) {
        const tableCheck = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
        ).get(schema.tableName);
        if (tableCheck) return schema.tableName;
      }
    } catch {
      // fall through
    }
  }

  return kbName;
}

export async function executeQueries(
  queries: Query[],
  exaClient?: ExaClient,
  onQueryExecuted?: (payload: QueryExecutedPayload) => void
): Promise<QueryExecutorResult> {
  const evidence: EvidenceBundle[] = [];
  const errors: string[] = [];

  const promises = queries.map(async (query) => {
    const startTime = Date.now();
    try {
      if (query.type === "sql") {
        const db = getDb();
        // Validate table reference (kbName may be a wiki name or table name)
        const tableName = resolveTableName(query.kbName);
        const tableCheck = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
        ).get(tableName);

        if (!tableCheck) {
          throw new Error(`Table ${query.kbName} not found`);
        }

        // Safety: only allow SELECT statements
        const normalized = query.sql.trim().toLowerCase();
        if (!normalized.startsWith("select")) {
          throw new Error("Only SELECT queries are allowed");
        }

        const rows = db.prepare(query.sql).all() as Record<string, unknown>[];

        const bundle: EvidenceBundle = {
          subClaimId: query.subClaimId,
          sourceType: "sqlite",
          query: query.sql,
          results: rows,
          timestamp: new Date().toISOString(),
        };

        evidence.push(bundle);
        onQueryExecuted?.({
          subClaimId: query.subClaimId,
          sourceType: "sqlite",
          query: query.sql,
          resultCount: rows.length,
          durationMs: Date.now() - startTime,
        });
      } else if (query.type === "exa") {
        if (!exaClient) {
          throw new Error("Exa client not available");
        }

        const params: ExaSearchParams = {
          query: query.query,
          type: "deep",
          numResults: query.numResults ?? 5,
          ...(query.includeDomains?.length ? { includeDomains: query.includeDomains } : {}),
          ...(query.excludeDomains?.length ? { excludeDomains: query.excludeDomains } : {}),
          ...(query.startPublishedDate ? { startPublishedDate: query.startPublishedDate } : {}),
          ...(query.endPublishedDate ? { endPublishedDate: query.endPublishedDate } : {}),
          ...(query.category ? { category: query.category } : {}),
        };

        const result = await exaClient.search(params);

        const bundle: EvidenceBundle = {
          subClaimId: query.subClaimId,
          sourceType: "exa",
          query: query.query,
          results: result.results,
          timestamp: new Date().toISOString(),
        };

        evidence.push(bundle);
        onQueryExecuted?.({
          subClaimId: query.subClaimId,
          sourceType: "exa",
          query: query.query,
          resultCount: result.results.length,
          durationMs: Date.now() - startTime,
        });
      }
    } catch (err: any) {
      errors.push(`Query failed (${query.type}): ${err.message}`);
      onQueryExecuted?.({
        subClaimId: query.subClaimId,
        sourceType: query.type === "sql" ? "sqlite" : "exa",
        query: query.type === "sql" ? query.sql : query.query,
        resultCount: 0,
        durationMs: Date.now() - startTime,
      });
    }
  });

  await Promise.all(promises);

  return { evidence, errors };
}
