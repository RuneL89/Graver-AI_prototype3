# Database Layer — Agent Guidance Document

> Durable boundary: SQLite database connection, migrations, ingestion parser, and safe query execution.

---

## Purpose

SQLite database layer. Connection management, migrations, schema parsing, and safe query execution.

## Ownership

- `connection.ts` — singleton connection with WAL mode
- `migrate.ts` — idempotent inline SQL migrations
- `parser.ts` — CSV/JSON ingestion, type inference, table name generation
- `execution.ts` — safe profiling query execution (SELECT-only enforcement)

## Local Contracts

- `connection.ts` provides a singleton `Database` instance with WAL mode enabled. `getDb()` initializes on first call; `closeDb()` cleans up.
- `migrate.ts` runs idempotent inline SQL migrations on startup. Duplicate columns are ignored via try/catch.
- `parser.ts` handles CSV/JSON ingestion, type inference, and generates table names (`kb_<name>_<timestamp>`).
- `execution.ts` enforces SELECT-only queries. All SQL must start with `select ` (checked via lowercase trim).
- Table names are validated against `sqlite_master` before execution.

## Work Guidance

- Never write raw SQL outside `db/` without safety checks.
- Migrations must be idempotent (use `IF NOT EXISTS` or catch duplicate column errors).
- Parser-generated table names must remain predictable for the wiki-to-table mapping.
- Keep large TEXT/BLOB values truncated when sampling rows for LLM context (max 300 chars).

## Verification

- Migrations run automatically on `getDb()` call in `server.ts`.
- `npm run migrate -w backend` runs `tsx src/db/migrate.ts` manually.
- `npm run typecheck -w backend`

## Child DOX Index

None
