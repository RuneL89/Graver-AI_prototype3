import { Router } from "express";
import { getDb } from "../db/connection.js";

const router = Router();

const TABLE_NAME_REGEX = /^kb_[a-zA-Z0-9_]+$/;

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}

router.get("/source/:tableName", async (req, res) => {
  const { tableName } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 1000);
  const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

  // Validate table name format
  if (!TABLE_NAME_REGEX.test(tableName)) {
    return res.status(400).json({ error: "Invalid table name" });
  }

  const db = getDb();

  // Verify table actually exists in the database
  const tableCheck = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
    )
    .get(tableName) as { name: string } | undefined;

  if (!tableCheck) {
    return res.status(404).json({ error: "Table not found" });
  }

  try {
    // Get column metadata (pragma cannot be parameterized)
    const columnInfo = db.prepare(`PRAGMA table_info("${tableName}")`).all() as ColumnInfo[];
    const columns = columnInfo.map((c) => ({ name: c.name, type: c.type }));

    // Get total row count
    const countResult = db
      .prepare(`SELECT COUNT(*) as count FROM "${tableName}"`)
      .get() as { count: number };
    const totalCount = countResult.count;

    // Get rows
    const rowsResult = db
      .prepare(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`)
      .all(limit, offset) as Record<string, unknown>[];

    // Normalize rows to arrays matching column order
    const rows = rowsResult.map((row) =>
      columns.map((col) => row[col.name] ?? null)
    );

    res.json({
      tableName,
      columns,
      rows,
      totalCount,
      limit,
      offset,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
