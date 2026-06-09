# Routes — Agent Guidance Document

> Durable boundary: Express routers for ingestion, investigation, wiki, and SQLite data browsing.

---

## Purpose

Express routers for ingestion, investigation, wiki, and SQLite data browsing.

## Ownership

- `ingest.ts` — upload, chunked upload, profiling, planning, approval, wiki write; async pipeline with client polling
- `investigate.ts` — start, cancel, retry, SSE stream, status/fetch; in-memory sessions and SQLite persistence
- `wiki.ts` — KB listing, page CRUD, rename, delete KB
- `source.ts` — SQLite table browsing with pagination

## Local Contracts

- `investigate.ts` manages in-memory `Map<string, InvestigationSession>` sessions during execution.
- SSE at `GET /api/investigate/:id/stream` uses `text/event-stream` with 15s heartbeat keepalives.
- Completed investigations are persisted to SQLite `investigations` table (`dossier_json`, `evidence_json`).
- `GET /api/investigations` and `GET /api/investigations/:id` serve persisted data.
- All routes return JSON errors with appropriate HTTP status codes.

## Work Guidance

- Return JSON for all errors. Use appropriate HTTP status codes.
- Investigation SSE events: `stage_start`, `reasoning`, `query_executed`, `stage_complete`, `error`.
- Ingestion async pipeline uses job IDs and polling endpoints.
- File uploads are written to `UPLOAD_TMP_DIR` (default `/tmp`) and cleaned up after processing.

## Verification

- End-to-end flows through the UI (upload → profile → approve → investigate).
- `npm run typecheck -w backend`

## Child DOX Index

None
