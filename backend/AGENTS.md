# Backend — Agent Guidance Document

> Durable boundary: Express API runtime, HTTP surface, middleware, and external clients.

---

## Purpose

Backend runtime for Graver-AI. Express server, middleware, route mounting, graceful shutdown, and the Exa.ai web-search client.

## Ownership

- `server.ts` — entry point, route mounting, global error handling, graceful shutdown
- `src/exa/client.ts` — Exa.ai REST API wrapper with jittered retry
- Environment variable defaults and runtime behavior

## Local Contracts

- `server.ts` is the sole entry point. It mounts all routes under `/api`, applies CORS, sets JSON body limit to `50mb`, and ensures DB migrations run before accepting requests.
- Environment variables (with defaults):
  - `PORT` → `3001`
  - `DATABASE_PATH` → `./data/graver.db`
  - `WIKI_PATH` → `./wiki`
  - `CONFIG_PATH` → `./data/config.json`
  - `UPLOAD_TMP_DIR` → `/tmp`
- Graceful shutdown handles `SIGTERM` and `SIGINT`.
- All errors return JSON; a 404 handler is present.
- Exa client wraps the Exa.ai REST API with jittered retry logic.

## Work Guidance

- Add new routes by creating a router file in `src/routes/` and mounting it in `server.ts`.
- Keep route files focused on HTTP concerns; business logic belongs in `agents/` or `skills/`.
- Use `.js` extensions in all imports (NodeNext module resolution).
- Log requests with timestamp, method, and path.

## Verification

- `npm run dev -w backend` — starts with tsx watch
- `npm run build -w backend` — compiles with tsc
- `GET /api/health` — health check endpoint

## Child DOX Index

- `src/db/` — SQLite connection, migrations, parser, execution safety
- `src/llm/` — Unified LLM client with retry, timeout, streaming
- `src/config/` — Config store, key masking, test routes
- `src/routes/` — Express routers, API endpoints, SSE streaming
- `src/agents/` — LangGraph graph definitions, pipeline orchestration
- `src/skills/` — AgentSkill implementations, prompts, Zod schemas
- `src/wiki/` — File-system wiki store, path safety
