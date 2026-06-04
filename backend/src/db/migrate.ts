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
  `ALTER TABLE ingestion_jobs ADD COLUMN wiki_name TEXT;`,
  `ALTER TABLE ingestion_jobs ADD COLUMN progress_message TEXT;`,
];

export function runMigrations(): void {
  const db = getDb();
  for (const sql of MIGRATIONS) {
    try {
      db.exec(sql);
    } catch (err: any) {
      // Ignore "duplicate column name" errors from ADD COLUMN migrations
      if (err.message?.includes("duplicate column name")) {
        continue;
      }
      throw err;
    }
  }
  console.log("Migrations applied successfully.");
}

// Allow running standalone via `tsx src/db/migrate.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}
