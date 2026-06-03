import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATABASE_PATH = process.env.DATABASE_PATH || "./data/graver.db";

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    ensureDir(DATABASE_PATH);
    dbInstance = new Database(DATABASE_PATH);
    dbInstance.pragma("journal_mode = WAL");
    console.log(`SQLite database opened at ${DATABASE_PATH}`);
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log("SQLite database closed.");
  }
}
