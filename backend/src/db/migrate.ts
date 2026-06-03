import { getDb } from "./connection.js";

const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'pending',
    filename TEXT NOT NULL,
    schema_json TEXT NOT NULL,
    plan_json TEXT,
    approved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,
];

export function runMigrations(): void {
  const db = getDb();
  for (const sql of MIGRATIONS) {
    db.exec(sql);
  }
  console.log("Migrations applied successfully.");
}

// Allow running standalone via `tsx src/db/migrate.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}
