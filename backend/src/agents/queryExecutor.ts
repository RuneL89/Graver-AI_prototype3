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
        // Validate table reference
        const tableCheck = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
        ).get(query.kbName);

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
