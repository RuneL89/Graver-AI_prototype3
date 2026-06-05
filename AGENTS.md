# Graver-AI — Agent Guidance Document

> This file is written for AI coding agents. Expect the reader to know nothing about the project. All information below is derived from the actual codebase — do not make assumptions beyond what is documented here.

---

## 1. Project Overview

Graver-AI is a browser-based research acceleration tool for investigative journalists. A user enters a plain-language tip. The system decomposes it into researchable sub-claims, queries multiple structured knowledge bases in parallel (SQLite databases and Exa.ai web search), discovers cross-source connections, and produces a structured investigation dossier with full source attribution and confidence ratings.

It is an **agentic investigation engine** — not a fact-checker, not a summarizer — designed to discover leads from structured data.

**Current status:** Sprints 1–7 complete. Sprint 8 (Documentation & README Finalization) not yet started.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Monorepo manager | npm workspaces (root `package.json`) |
| Backend runtime | Node.js, TypeScript (ES2022, NodeNext module resolution) |
| Backend framework | Express 4 |
| Database | SQLite via `better-sqlite3` (WAL mode enabled) |
| Agent orchestration | LangGraph (`@langchain/langgraph`) with `MemorySaver` |
| LLM client | Unified client supporting OpenAI, Anthropic, Gemini, OpenRouter, custom endpoints |
| Web search | Exa.ai REST API |
| Schema validation | Zod |
| File upload | Multer |
| Frontend | React 18, TypeScript, Vite |
| Frontend styling | Tailwind CSS 3, `@tailwindcss/typography` |
| Frontend routing | React Router 6 |
| Markdown rendering | `react-markdown` + `remark-gfm` |
| Icons | `lucide-react` |

---

## 3. Repository Structure

```
.
├── backend/               # Express API + agent pipelines
│   ├── src/
│   │   ├── server.ts          # Entry point, route mounting, graceful shutdown
│   │   ├── config/            # App config routes & JSON store
│   │   ├── db/                # SQLite connection, migrations, parser, execution
│   │   ├── llm/               # Unified LLM client (complete, structured, stream)
│   │   ├── exa/               # Exa.ai client (search, contents)
│   │   ├── routes/            # Express routers: ingest, investigate, wiki, source
│   │   ├── agents/            # LangGraph graphs: investigation, ingestion, queryExecutor
│   │   ├── skills/            # Individual agent skills (prompts + execute)
│   │   └── wiki/              # File-system wiki store
│   ├── data/                  # SQLite DB, config.json (gitignored)
│   ├── wiki/                  # Markdown knowledge bases (gitignored)
│   └── .env                   # Secrets (gitignored, blocked from read)
├── frontend/              # React SPA
│   ├── src/
│   │   ├── main.tsx           # React entry (StrictMode, Router, Providers)
│   │   ├── App.tsx            # Route definitions
│   │   ├── pages/             # Config, Ingest, Investigate, Wiki pages
│   │   ├── components/        # Panels, stream viewer, dossier viewer, layout
│   │   └── context/           # AppContext, ConfigContext
│   └── index.html
├── shared/                # Cross-cutting TypeScript types & Zod schemas
│   └── types.ts
├── plan/
│   ├── DATASETS.md            # Description of the four demo knowledge base datasets
│   ├── FRD_Graver_AI_Prototype.md       # Functional Requirements Document
│   ├── IMPLEMENTATION_PLAN_Graver_AI.md # Sprint-structured build sequence
│   ├── SPRINT_INSTRUCTIONS.md # Sprint progression tracker
│   └── sprint-0N-*/           # Sprint-specific instruction documents
├── demo/                  # Reserved for demo data (currently empty)
├── AGENTS.md              # This file
└── README.md              # Project README (to be replaced in Sprint 8)
```

---

## 4. Build and Development Commands

All commands run from the repository root.

```bash
# Install dependencies for all workspaces
npm install

# Development: run backend (port 3001) and frontend (port 5173) concurrently
npm run dev

# Production build: shared → backend → frontend
npm run build

# Type-check all workspaces
npm run typecheck
```

**Backend-only commands** (`-w backend`):
```bash
npm run dev -w backend       # tsx watch src/server.ts
npm run build -w backend     # tsc (emits to backend/dist/)
npm run typecheck -w backend # tsc --noEmit
npm run migrate -w backend   # tsx src/db/migrate.ts
```

**Frontend-only commands** (`-w frontend`):
```bash
npm run dev -w frontend      # vite (port 5173, proxies /api → localhost:3001)
npm run build -w frontend    # tsc && vite build
npm run typecheck -w frontend# tsc --noEmit
```

**Shared workspace** (`-w shared`):
```bash
npm run build -w shared      # tsc (emits to shared/dist/)
```

> The frontend Vite config proxies `/api` to `http://localhost:3001` with infinite timeout for long-running SSE streams.

---

## 5. Runtime Architecture

- **Backend port:** `3001` (default, overridable via `PORT` env var).
- **Frontend port:** `5173` (Vite dev server).
- **Database:** SQLite file at `./data/graver.db` (overridable via `DATABASE_PATH`). WAL mode is enabled.
- **Wiki storage:** Markdown files under `./wiki/` (overridable via `WIKI_PATH`). Each KB is a subdirectory.
- **Configuration:** JSON file at `./data/config.json` (overridable via `CONFIG_PATH`). Stores LLM provider, model, API keys (masked when returned), Exa key, max rounds, and Exa search type.
- **Environment variables:** Loaded from `backend/.env` via `dotenv`. The actual `.env` in this workspace contains `DATABASE_PATH`, `NODE_ENV`, `PORT`, and `WIKI_PATH`. Fallback env vars (`LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`, `EXA_API_KEY`) are supported by the code for legacy use when no config has been saved via the UI.

**Key runtime behaviors:**
- The backend runs SQLite migrations automatically on startup.
- Investigations run in-memory only (no persistence). Sessions are stored in a `Map` and streamed via SSE.
- File uploads are written to `/tmp` (or `UPLOAD_TMP_DIR`), then parsed into SQLite.
- The frontend uses `localStorage` to cache recent investigation tips (`graver_recent_tips`).

---

## 6. Code Organization & Module Divisions

### 6.1 Backend Modules

| Module | Responsibility |
|---|---|
| `config/routes.ts` | CRUD for app config, LLM/Exa connection testing |
| `config/store.ts` | Zod-validated JSON config file read/write, key masking |
| `db/connection.ts` | Singleton SQLite connection with WAL |
| `db/migrate.ts` | Inline SQL migrations (idempotent, ignores duplicate columns) |
| `db/parser.ts` | CSV/JSON parsing, type inference, table name generation |
| `db/execution.ts` | Safe profiling query execution (SELECT-only) |
| `llm/client.ts` | Unified LLM client: completion, structured JSON, streaming. Retry with exponential backoff for rate limits. Timeout via `AbortController`. |
| `llm/errors.ts` | Typed error classes: `LLMRateLimitError`, `LLMTimeoutError`, `LLMProviderError` |
| `exa/client.ts` | Exa.ai search & contents. Jittered retry logic. |
| `routes/ingest.ts` | Upload, chunked upload, profiling, planning, approval, wiki write. Also supports async pipeline execution with client polling. |
| `routes/investigate.ts` | Start, cancel, retry, SSE stream, status/fetch endpoints |
| `routes/wiki.ts` | KB listing, page CRUD, rename, delete KB |
| `routes/source.ts` | SQLite table browsing, pagination |
| `agents/investigationGraph.ts` | LangGraph: decomposer → navigator → generator → executor → resolver → synthesizer → auditor → [loop or assembler → writeback] |
| `agents/ingestionGraph.ts` | LangGraph definition for profiler → sqlExecution → architect → humanGate → writer (exists but the primary ingestion flow runs via async endpoints in `routes/ingest.ts`) |
| `agents/queryExecutor.ts` | Parallel execution of SQLite and Exa queries |
| `skills/*.ts` | AgentSkill implementations (see pattern below) |
| `wiki/store.ts` | Async file-system operations for wiki pages and KBs |

### 6.2 Frontend Modules

| Module | Responsibility |
|---|---|
| `pages/ConfigPage.tsx` | LLM/Exa provider setup, testing, saving |
| `pages/IngestPage.tsx` | Upload + ingestion agent inventory sidebar |
| `pages/InvestigatePage.tsx` | Investigation panel + agent inventory sidebar |
| `pages/WikiPage.tsx` | Wiki viewer/CRUD with markdown rendering, wikilink navigation, source table modal |
| `components/InvestigationPanel.tsx` | Tip input, start/cancel/retry, results display |
| `components/AgentStream.tsx` | SSE consumer, stage tracking, reasoning display, auto-scroll with pause/resume |
| `components/DossierViewer.tsx` | Collapsible dossier with confidence color-coding |
| `components/StageProgress.tsx` | Pipeline diagram of active/completed stages, round counter |
| `components/IngestionPanel.tsx` | Drag-drop upload, plan approval, profiling display, table preview |
| `components/MainLayout.tsx` | Top nav, footer, responsive layout |
| `components/AgentInventory.tsx` | Sidebar listing all investigation and ingestion agents with descriptions |
| `components/ErrorDisplay.tsx` | Retryable error card with stage context |
| `components/SourceTableModal.tsx` | SQLite table browser modal with pagination |
| `context/ConfigContext.tsx` | Global config state synced with `/api/config` |
| `context/AppContext.tsx` | Global app state (active tab) |

### 6.3 Shared Module

`shared/types.ts` defines:
- `AgentSkill<Input, Output>` interface (name, description, inputSchema, outputSchema, execute)
- `AgentContext` interface (llmClient, exaClient, wikiStore, dbConnection, emitReasoning)
- LLM/Exa/Wiki/Database client interfaces
- Domain types: `InvestigationState`, `Dossier`, `SubClaim`, `EvidenceBundle`, `Synthesis`, `ConnectionFinding`, etc.
- Ingestion types: `IngestionJob`, `TableSchema`, `WikiPlan`, `ProfilingResult`, etc.
- SSE event types: `StageEvent`, `ReasoningChunkEvent`, `QueryExecutedEvent`

---

## 7. Development Conventions

### 7.1 TypeScript

- **Strict mode** is enabled in all `tsconfig.json` files.
- Backend uses `module: "NodeNext"` and `moduleResolution: "NodeNext"` — imports must use `.js` extensions even for `.ts` source files.
- Frontend uses `module: "ESNext"` and `moduleResolution: "bundler"` — imports also use `.js` extensions.
- Shared workspace is built first; backend and frontend reference `../shared/dist` via TypeScript project references and path mapping.
- All packages declare `"type": "module"`.

### 7.2 Code Style

- No ESLint or Prettier configuration exists in the repository.
- Match existing code style exactly. Do not reformat unrelated code.
- Use functional React components with hooks.
- Use Tailwind utility classes for all styling.
- Lucide icons are imported individually (e.g., `import { Search } from "lucide-react"`).

### 7.3 Import Patterns

```ts
// Backend: always .js, always relative
import { getDb } from "./db/connection.js";
import type { InvestigationState } from "@graver-ai/shared";

// Frontend: .js extensions, relative paths
import ConfigPage from "./pages/ConfigPage.js";
import type { Dossier } from "@graver-ai/shared";
```

### 7.4 Skill Pattern

Every agent skill follows this exact contract:

```ts
import { z } from "zod";
import type { AgentSkill, AgentContext } from "@graver-ai/shared";

const inputSchema = z.object({ ... });
const outputSchema = z.object({ ... });

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export const mySkill: AgentSkill<Input, Output> = {
  name: "mySkill",
  description: "...",
  inputSchema,
  outputSchema,
  async execute(input: Input, context: AgentContext): Promise<Output> {
    // Use context.llmClient.completeStructured() for JSON output
    // Emit reasoning via context.emitReasoning?.(chunk)
    return { ... };
  },
};
```

- Skills that call LLMs should use `completeStructured` with Zod schemas for JSON output.
- LLM outputs are often normalized to handle field name variations (e.g., `claimText` vs `claim`). Many skills use a lenient `rawOutputSchema` to accept variations, then normalize to a strict `outputSchema`.
- LangGraph nodes are thin wrappers that import the skill file, extract inputs from graph state, call the skill function, and write outputs back to graph state. Skills must not depend on Express routes, LangGraph state, or UI components.

### 7.5 Safety Patterns

- **SQL safety:** Only `SELECT` queries are allowed in user-facing query execution. The `queryExecutor.ts` and `execution.ts` enforce this by checking `sql.trim().toLowerCase().startsWith("select")`.
- **Path safety:** The wiki store sanitizes `kbName` (`/[^a-zA-Z0-9_-]/g → "_"`) and rejects paths containing `..`.
- **Upload safety:** Multer writes to a temp directory; files are deleted after processing or on error.
- **API key masking:** Config keys are masked (first 4 + `****` + last 4) when returned to the frontend. Keys are never logged.

---

## 8. Testing

**There are currently no automated tests in this repository.** No Jest, Vitest, Playwright, or Cypress configurations exist.

Testing is done manually via:
- The **Test LLM Connection** and **Test Exa Connection** buttons on the Config page.
- End-to-end flows through the UI (upload → profile → approve → investigate).
- Sprint-based UAT acceptance criteria (see `plan/SPRINT_INSTRUCTIONS.md`).

If you add tests, follow the existing stack choices and place them near the code they test.

---

## 9. Security Considerations

- **API keys** are stored in `backend/data/config.json` and masked when returned to the frontend. Keys are never logged.
- **`.env`** contains secrets and is gitignored. The backend loads it via `dotenv/config`.
- **SQL injection:** User-generated SQL is rejected unless it starts with `SELECT `. Table names are validated against `sqlite_master` before execution.
- **File upload:** Chunked upload is supported for large files. Temp files are cleaned up after processing.
- **CORS:** Enabled globally on the Express server.
- **Request body limit:** Express JSON parser limit is set to `50mb` to accommodate large ingestion payloads.

---

## 10. Data Flow Summary

### Ingestion Pipeline (Pipeline A)
1. User uploads CSV/JSON → parsed into SQLite table (`kb_<name>_<timestamp>`).
2. `statisticalProfilerSkill` generates SQL profiling queries from schema.
3. Queries execute via `executeProfilingQueries` (SELECT-only).
4. `wikiArchitectSkill` drafts a wiki plan (index + entity pages).
5. User reviews, modifies, and approves the plan in the UI.
6. `wikiWriterSkill` generates final markdown with wikilinks and source citations.
7. Pages are written to `./wiki/<kbName>/`.

### Investigation Pipeline (Pipeline B)
1. User submits a tip.
2. `tipDecomposerSkill` breaks it into 3–5 sub-claims.
3. `kbNavigatorSkill` assigns relevant KBs per sub-claim.
4. `queryGeneratorSkill` creates SQL or Exa queries.
5. `queryExecutor` runs queries in parallel.
6. `entityResolverSkill` finds cross-source connections.
7. `evidenceSynthesizerSkill` assembles narratives with confidence ratings.
8. `gapAuditorSkill` decides: CONTINUE, STOP_COMPLETE, or STOP_WITH_GAPS.
9. If CONTINUE and rounds < max → loop back to navigator with cumulative context.
10. `dossierAssemblerSkill` formats the final dossier.
11. `wikiWritebackSkill` files findings into the wiki.

All stages emit SSE events (`stage_start`, `reasoning`, `query_executed`, `stage_complete`, `error`) consumed by `AgentStream.tsx`.

---

## 11. Environment Variables

The backend reads these environment variables (defined in `backend/.env`):

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Backend HTTP port | `3001` |
| `DATABASE_PATH` | SQLite file path | `./data/graver.db` |
| `WIKI_PATH` | Wiki directory path | `./wiki` |
| `CONFIG_PATH` | Config JSON file path | `./data/config.json` |
| `UPLOAD_TMP_DIR` | Multer temp directory | `/tmp` |
| `LLM_PROVIDER` | Fallback LLM provider | `openai` |
| `LLM_API_KEY` | Fallback LLM API key | *(empty)* |
| `LLM_MODEL` | Fallback LLM model | `gpt-4o-mini` |
| `LLM_BASE_URL` | Fallback custom base URL | *(undefined)* |

> Fallback env vars are only used when no config has been saved via the UI (legacy support).

---

## 12. Karpathy-Inspired Coding Guidelines

These guidelines are in effect for all changes to this repository.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 12.1 Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 12.2 Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 12.3 Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 12.4 Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
