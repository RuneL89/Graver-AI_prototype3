# Graver-AI

Graver-AI is a browser-based research acceleration tool for investigative journalists and researchers. A user enters a plain-language tip (for example, a question about whether military equipment from one country contributes to a conflict in another) and the system decomposes it into researchable sub-claims, queries multiple structured knowledge bases in parallel, discovers cross-source connections, and produces a structured investigation dossier with full source attribution and confidence ratings. It is an **agentic investigation engine** that discovers leads from structured data for human investigators to follow up on.

The repository ships with four pre-ingested demo knowledge bases (business registries, export licenses, defense procurement programs, and conflict incident records) so the system can be evaluated immediately. These datasets illustrate cross-source tracing capabilities, but Graver-AI is built as a general-purpose platform: point it at any collection of structured CSV or JSON datasets and it will build a queryable knowledge base and investigate tips against it.
<img width="936" height="527" alt="image" src="https://github.com/user-attachments/assets/10b8c1e8-9dbd-447c-998d-e0a3e1e89c3d" />


---

## What the System Does

Graver-AI supports two main user journeys: **Data Ingestion** (Pipeline A) and **Investigation** (Pipeline B).

### Pipeline A: Turning Data into a Queryable Knowledge Base
<img width="3152" height="282" alt="image" src="https://github.com/user-attachments/assets/f728fc44-e4b1-4680-9cea-abcf236c29ce" />

When a user has a new dataset, they upload it through a drag-and-drop web interface. The system handles the rest:

1. **Upload and Parse**. The user drops a CSV or JSON file. The system infers column types, detects potential foreign keys by naming convention, and creates a typed SQLite table.
2. **Statistical Profiling**. An LLM agent receives only the schema and a small sample of rows. It proposes SQL aggregate queries to understand the data landscape: frequency distributions, outliers, null rates, temporal patterns, and correlations. These queries run against the full dataset via pure code. No domain knowledge is injected.
3. **Wiki Plan Proposal**. A second LLM agent reads the profiling results and drafts a wiki structure: an `index.md` describing what the knowledge base contains, what questions it can answer, and proposed entity or segment pages for statistically notable groups.
4. **Human Approval**. The plan appears in the UI. The user reviews, modifies, or rejects it before any wiki pages are written. The pipeline pauses here and only resumes after explicit approval.
5. **Wiki Generation**. A writer agent generates polished markdown pages with wikilinks, citation anchors back to database tables, and structured headers. The pages are stored on disk and become the agent-facing interface to the data.

The result is a two-layer architecture: the **database** contains the raw structured data, and the **wiki** contains a human-readable map that tells agents what questions each knowledge base can answer.


### Pipeline B: Investigating a Tip
<img width="3305" height="357" alt="image" src="https://github.com/user-attachments/assets/63597f15-2d50-414d-beef-2074a94a914d" />

When a user submits a free-text tip, the system runs a multi-agent investigation loop:

1. **Tip Decomposition**. The tip is broken into 3–5 independently researchable sub-claims, each phrased as a focused research question with a target entity type.
2. **Knowledge Base Navigation**. For each sub-claim, an agent reads every available wiki index page and assigns relevance scores (0.0–1.0) to the knowledge bases most likely to yield evidence. It decides whether to query local SQLite databases, Exa.ai for web research, or both.
3. **Query Generation**. The agent generates precise SQL queries for SQLite KBs (with JOINs, filters, aggregations) or semantic search parameters for Exa.ai (query strings, category filters, date ranges, domain restrictions).
4. **Query Execution**. All queries run in parallel. SQLite queries execute via the database driver in milliseconds. Exa queries execute via HTTP API. Error isolation means one failed query does not stop the others.
5. **Entity Resolution**. The agent examines result sets from all sources and looks for shared identifiers: CVR numbers, company names, dates, locations, program names. It flags potential matches, aliases, and cross-references, and explicitly notes when web evidence confirms or contradicts database evidence.
6. **Evidence Synthesis**. The agent assembles narrative summaries per sub-claim, assigning confidence ratings: **HIGH** (direct evidence, multiple sources), **MEDIUM** (inferred connections), or **LOW** (single source, circumstantial).
7. **Gap Auditing**. An auditor evaluates the cumulative investigation state across three checks:
   - **Novelty**, Did this round produce new entities or connections?
   - **Coverage**, Does every sub-claim have at least some evidence?
   - **Opportunity**, Are there unqueried knowledge bases or Exa searches that might yield productive evidence?
8. **Loop Decision**. The auditor returns one of three decisions:
   - **CONTINUE**, Route back to the navigator for another round with cumulative context.
   - **STOP_COMPLETE**, All sub-claims are covered; no new connections are expected.
   - **STOP_WITH_GAPS**, Coverage holes exist that cannot be filled by available data.
9. **Dossier Assembly**. If stopped, a final agent formats a structured markdown dossier with: Executive Summary, Findings by Sub-Claim, Cross-Source Connections, Evidence Gaps, Confidence Summary, Source Attribution, and Suggested Next Steps.
10. **Wiki Writeback**. The investigation findings are filed as new markdown pages in the wiki, and relevant KB index pages are updated to note new cross-KB connections. The wiki compounds over time.

The loop has a hard safety cap of **5 rounds**. After 5 rounds, the system stops regardless of the auditor's decision to prevent runaway investigations.

### Pre-Ingested Demo Datasets

The repository includes four knowledge bases already loaded into SQLite and the wiki. They are provided as **example data for demonstration and evaluation**, not as the product's sole purpose:

| Knowledge Base | Records | Type | Domain |
|---|---|---|---|
| CVR_Register_OpenSanctions_FtM | ~2,000,000 | Real | Danish business registry (companies, directors, CVR numbers) |
| Danish_Arms_Export_Licenses | 500 | Synthetic | Export license records (exporter, product, destination, end-user) |
| Defense_Procurement_Programs | 200 | Mixed | Weapons program frameworks + supplier component records |
| Multi-Conflict_Civilian_Harm_Incidents | 500 | Based on Airwars | Civilian harm incidents across Gaza, Iraq/Syria, Yemen, Libya, Ukraine |

These datasets span four distinct domains and share identifiers (CVR numbers, program names, platform types) that allow the agent to attempt cross-source entity tracing. They are intentionally designed with a mix of relevant and noise records so the system must distinguish signal from data, rather than following a scripted path. A user could submit a tip about supply chains, corporate ownership, or conflict incidents: the agent discovers what the data supports, without guarantees about any specific outcome.

---

## How the Agents Work (For Developers)

### Pipeline A: Data Ingestion Flow

**Statistical Profiler Agent** receives schema metadata (column names, types, foreign keys) plus a sample of rows. It is explicitly instructed to use only statistical reasoning. No domain knowledge is used, and it outputs 5–8 SQL aggregate queries. This ensures the profiling is grounded in what the data actually contains, not what an LLM assumes it contains.

**SQL Execution Engine** is pure non-LLM code. It runs each profiler query against the uploaded SQLite table, validates that queries start with `SELECT`, and returns aggregate results as JSON. Errors are caught and surfaced without crashing the pipeline.

**Wiki Architect Agent** receives only the aggregate profiling results, never raw rows. It drafts a `WikiPlan` containing `indexContent`, `proposedPages`, and `linkageHints`. The plan describes what the KB contains, what segments exist, and what cross-KB connections are possible.

**Human Approval Gate** is a breakpoint, not an agent. The backend stores the plan and exposes it via API. The frontend renders it in an editable panel. The user must explicitly approve or modify the plan via a POST request. The pipeline only resumes after this signal.

**Wiki Writer Agent** receives the approved plan plus the raw statistical results. It generates final markdown pages with proper headers, wikilinks (`[[path|Text]]`), and citation anchors (`[source: table_name]`). Pages are written to disk via the wiki store.

### Pipeline B: Investigation Flow

**Tip Decomposer Agent** receives the raw tip plus all KB index pages. It outputs a `ResearchPlan` with 3–5 `SubClaim` objects, each containing a focused research question and target entity type. It emits reasoning chunks in real time via SSE.

**KB Navigator Agent** receives one sub-claim plus all index pages. It outputs `KBAssignment` objects with `kbName`, `sourceType` (`sqlite` | `exa`), `relevanceScore` (0.0–1.0), and `justification`. It emits reasoning chunks.

**Query Generator Agent** receives a sub-claim and the schema of its assigned KBs. For SQLite, it outputs `SqlQuery` objects with JOINs, filters, and aggregations. For Exa, it outputs `ExaQuery` objects with semantic query strings, category filters, date ranges, and domain restrictions. It emits reasoning chunks.

**Query Executor** is a non-LLM node. It runs SQLite queries via `better-sqlite3` and Exa queries via the Exa client. Execution is parallel via `Promise.allSettled`. One failure does not abort the others.

**Entity Resolver Agent** receives all result sets. It looks for shared identifiers across sources: CVR numbers, names, dates, locations, program names. It outputs `ConnectionFinding` objects with confidence scores, noting matches, aliases, and contradictions.

**Evidence Synthesizer Agent** receives raw results, entity pages, and connection findings. It outputs `Synthesis` with one narrative entry per sub-claim, each with a HIGH/MEDIUM/LOW confidence rating and contradiction flags.

**Gap Auditor Agent** receives the full synthesis plus investigation state and round history. It runs the novelty/coverage/opportunity checks and returns an `AuditDecision`: CONTINUE, STOP_COMPLETE, or STOP_WITH_GAPS. If CONTINUE, it may suggest refined queries.

**Loop Controller** is a non-LLM conditional edge in the LangGraph. It routes based on the auditor's decision and the round counter. If CONTINUE and round < 5, it routes back to the navigator with cumulative context. Otherwise, it routes to the dossier assembler.

**Dossier Assembler Agent** receives the full synthesis, audit trail, and all evidence bundles. It outputs a `Dossier` with structured markdown sections.

**Gap Discovery Suggestions** (Pipeline C) fire only when the auditor returns STOP_WITH_GAPS and the gaps are unfillable. A suggestion block is appended to the dossier listing: what data is missing, what type of knowledge base would contain it, what public sources might exist, and a recommendation to acquire and ingest such data.

**Wiki Writeback Agent** receives the dossier. It creates a findings page under `findings/` and updates relevant KB index pages with bidirectional wikilinks.

### The Rejection Loop and Round Cap

The investigation loop is not a simple linear pipeline. It is a **rejection-sampling loop** where the agent proposes new queries each round and the auditor decides whether the marginal value justifies another iteration.

- **CONTINUE** is triggered when: new entities or connections were discovered this round; coverage gaps exist that can plausibly be filled by querying additional KBs; or unqueried KBs have high opportunity scores.
- **STOP_COMPLETE** is triggered when: every sub-claim has direct evidence from multiple sources; no new connections are expected from additional rounds; and all high-opportunity KBs have already been queried.
- **STOP_WITH_GAPS** is triggered when: coverage holes exist, but available KBs and Exa searches are unlikely to fill them. The system stops rather than spinning uselessly.

The **5-round hard cap** exists because each round costs LLM tokens and Exa API calls, and because human reviewers need a bounded timeframe. Even if the auditor says CONTINUE, round 5 always routes to the dossier assembler.

**Cumulative context** means that in round 2+, the navigator and query generator receive not just the original tip, but the full synthesis, connection findings, and previously executed queries from round 1. This prevents redundant queries and enables increasingly refined investigation.

### Demo Data Architecture

The four pre-ingested knowledge bases are stored as separate tables within a single SQLite database file and as separate markdown directories in the wiki file system. They were loaded to evaluate the system's ability to trace entities across disparate domains:

- **CVR_Register_OpenSanctions_FtM** provides entity identifiers (CVR numbers, company names) that can link to other datasets.
- **Danish_Arms_Export_Licenses** provides transaction records with foreign keys to the business registry.
- **Defense_Procurement_Programs** provides program frameworks and supplier links.
- **Multi-Conflict_Civilian_Harm_Incidents** provides incident records with platform types that may overlap with procurement data.

Shared identifiers allow the agent to *attempt* cross-source connections, but the system discovers leads rather than following a scripted path. The datasets contain substantial noise (hundreds of unrelated records across multiple conflicts, companies, and product categories) so the agent must genuinely search and filter, not retrieve pre-stitched results.

The `demo/` directory at the repository root is reserved for future dataset storage but is currently empty. The ingested data lives in `backend/data/` (SQLite, tracked via Git LFS) and `backend/wiki/` (markdown), both included in the repository so the system works immediately after cloning.

---

## Technical Architecture

### Stack

- **Monorepo**: npm workspaces with three packages (`@graver-ai/backend`, `@graver-ai/frontend`, `@graver-ai/shared`)
- **Backend**: Node.js 20+, Express 4, TypeScript (ES2022, NodeNext module resolution), strict mode
- **Database**: SQLite via `better-sqlite3` with WAL mode enabled
- **Agent Orchestration**: LangGraph.js (`@langchain/langgraph`) with `MemorySaver` checkpointing
- **LLM Client**: Unified client supporting OpenAI, Anthropic, Gemini, OpenRouter, and custom endpoints
- **Web Search**: Exa.ai REST API
- **Schema Validation**: Zod
- **File Upload**: Multer
- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS 3, `@tailwindcss/typography`
- **Routing**: React Router 6
- **Markdown Rendering**: `react-markdown` + `remark-gfm`
- **Icons**: `lucide-react`

### Data Architecture

**SQLite**: A single database file at `backend/data/graver.db` (overridable via `DATABASE_PATH`). Each uploaded dataset becomes a separate table with a `kb_<name>_<timestamp>` prefix. Types are inferred at ingestion: TEXT, INTEGER, REAL, or DATE. Foreign keys are detected by naming convention (`*_id`, `*_cvr`).

**Wiki File System**: Markdown files on disk under `backend/wiki/` (overridable via `WIKI_PATH`). Each KB is a subdirectory containing `index.md`, entity pages, and a global `findings/` directory for investigation results. The wiki store sanitizes directory names (`/[^a-zA-Z0-9_-]/g, then "_"`) and rejects paths containing `..`.

**Config File**: JSON at `backend/data/config.json` (overridable via `CONFIG_PATH`). Stores LLM provider, model, API keys, Exa key, max rounds, and Exa search type. Keys are masked (first 4 + `****` + last 4) when returned to the frontend via `GET /api/config`.

**Relationship**: The wiki describes the data; the database contains the data; the wiki is the agent-facing interface. Agents read index pages to understand what a KB contains before generating queries.

### Agent Architecture

Every agent is implemented as a **reusable skill file**: a standalone TypeScript module with no dependency on Express routes, LangGraph state, or UI components.

```typescript
interface AgentSkill<Input, Output> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<Input>;
  outputSchema: z.ZodSchema<Output>;
  execute(input: Input, context: AgentContext): Promise<Output>;
}

interface AgentContext {
  llmClient: LLMClient;
  exaClient?: ExaClient;
  wikiStore: WikiStore;
  dbConnection: DatabaseConnection;
  emitReasoning?: (chunk: string) => void;
}
```

LangGraph nodes are thin wrappers: extract inputs from graph state, then call `skill.execute()`, then write outputs back to state. This separation means skills can be tested independently and reused across pipelines.

Checkpointing persists state between rounds via `MemorySaver`, enabling resume after human gates and failures.

### LLM Client

`backend/src/llm/client.ts` provides a unified interface:

- **Providers**: OpenAI, Anthropic, Gemini, OpenRouter, custom endpoints via base URL
- **Modes**: Non-streaming (`complete()`), structured JSON (`completeStructured()` with Zod schemas), streaming (async generator yielding reasoning chunks)
- **Retry**: Exponential backoff (max 3 retries) on HTTP 429 rate limits
- **Timeout**: `AbortController` with configurable timeout
- **Errors**: Typed error classes in `backend/src/llm/errors.ts`:
  - `LLMRateLimitError`: rate limit hit after retries
  - `LLMTimeoutError`: request timed out
  - `LLMProviderError`: provider returned an error

### Exa Client

`backend/src/exa/client.ts` wraps the Exa.ai REST API:

- **Methods**: `search()`, `deepSearch()`, `getContents()`
- **Retry**: Jittered retry on transient failures
- **Structured output**: Uses Zod schemas for consistent result shapes
- **Search types**: `instant` / `fast` / `deep` (configurable via UI)

### API Layer

REST endpoints mounted in `backend/src/server.ts`:

| Route | File | Purpose |
|---|---|---|
| `GET /api/health` | `server.ts` | Health check |
| `/api/config/*` | `config/routes.ts` | CRUD, test connection |
| `/api/ingest/*` | `routes/ingest.ts` | Upload, profiling, plan approval |
| `/api/investigate/*` | `routes/investigate.ts` | Tip submission, SSE stream, cancel, retry, fetch |
| `/api/wiki/*` | `routes/wiki.ts` | KB listing, page CRUD, rename, delete KB |
| `/api/source/*` | `routes/source.ts` | SQLite table browsing with pagination |

**SSE Events** (`/api/investigate/:id/stream`):
- `stage_start`: agent stage began
- `reasoning_chunk`. LLM reasoning text
- `stage_complete`. agent stage finished
- `query_executed`. SQLite or Exa query completed
- `error`. stage-level failure
- `complete`. investigation finished
- `heartbeat`. every 15s to prevent proxy timeout

The frontend Vite config proxies `/api` to `http://localhost:3001` with an infinite timeout for long-running SSE streams.

### Frontend Architecture

- **State Management**: `AppContext` (React Context + `useReducer`) for global app state (active tab). `ConfigContext` for config load/update/distribution.
- **Routing**: `/config`, `/ingest`, `/investigate`, `/wiki`
- **Pages**: `ConfigPage`, `IngestPage`, `InvestigatePage`, `WikiPage`
- **Key Components**:
  - `AgentStream`: SSE consumer, stage tracking, reasoning display, auto-scroll with pause/resume
  - `StageProgress`, Visual pipeline diagram with round counter
  - `DossierViewer`, Collapsible markdown dossier with confidence color-coding
  - `IngestionPanel`, Drag-drop upload, plan approval, table preview, profiling results
  - `InvestigationPanel`, Tip input, start/cancel/retry, results display
  - `AgentInventory`, Sidebar listing all investigation and ingestion agents with descriptions
  - `ErrorDisplay`, Retryable error card with stage context
  - `SourceTableModal`, SQLite table browser modal triggered by `[source: table_name]` citations
- **Styling**: Tailwind utility classes throughout. No component libraries.
- **Icons**: Individual imports from `lucide-react`

### Security

- API keys are stored server-side only (`.env` fallback + `backend/data/config.json`). They are never sent to the frontend.
- `GET /api/config` masks keys. Keys are never logged.
- SQL injection prevention: only `SELECT` queries are allowed in user-facing execution. Table names are validated against `sqlite_master`.
- Path traversal prevention: wiki store sanitizes names and rejects `..`.
- Upload safety: Multer writes to a temp directory; files are deleted after processing or on error.
- No authentication, no multi-tenancy. This is a personal prototype.

### Error Handling

- Pipeline stops on agent/API/query failure. Errors are surfaced to the UI with stage context.
- Retry from beginning is supported via a retry button that restarts the full investigation.
- State is preserved up to the failure point via LangGraph checkpointing.
- LLM: exponential backoff retry (max 3). Exa: jitter retry. SQL: syntax errors caught pre-execution.

### Performance Targets

- Full investigation: under 3 minutes for a 5-round investigation with Exa queries
- SQLite queries: under 100ms
- Exa deep search: 12–40s per call (UI shows progress)
- SSE heartbeat: every 15s to prevent proxy timeouts

---

## Project Structure

```
graver-ai/
├── package.json                 - Root workspace config, dev scripts
├── README.md                    - This file
├── plan/
│   ├── SPRINT_INSTRUCTIONS.md   - Implementation anchor and sprint tracker
│   ├── DATASETS.md              - Demo dataset provenance and methodology
│   ├── FRD_Graver_AI_Prototype.md - Functional Requirements Document
│   ├── IMPLEMENTATION_PLAN_Graver_AI.md - Sprint-structured build sequence
│   └── sprint-0N-*/
│       └── instruction.md       - Sprint-specific implementation instructions
├── AGENTS.md                    - Agent guidance for AI coding assistants
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── types.ts                 - AgentSkill, AgentContext, all domain types
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                     - Runtime secrets (gitignored)
│   ├── src/
│   │   ├── server.ts            - Express entry, route mounting, graceful shutdown
│   │   ├── config/
│   │   │   ├── routes.ts        - Config CRUD endpoints, connection testing
│   │   │   └── store.ts         - Zod-validated JSON config file read/write, key masking
│   │   ├── db/
│   │   │   ├── connection.ts    - better-sqlite3 singleton with WAL mode
│   │   │   ├── migrate.ts       - Schema creation and migrations on startup
│   │   │   ├── parser.ts        - CSV/JSON to SQLite (type inference, FK detection)
│   │   │   └── execution.ts     - Safe SELECT-only query runner
│   │   ├── wiki/
│   │   │   └── store.ts         - Markdown file I/O (read, write, list, delete)
│   │   ├── llm/
│   │   │   ├── client.ts        - Unified LLM client with streaming and retry
│   │   │   └── errors.ts        - Typed LLM error classes
│   │   ├── exa/
│   │   │   └── client.ts        - Exa.ai API wrapper with jitter retry
│   │   ├── skills/              - Reusable agent skills (AgentSkill interface)
│   │   │   ├── tipDecomposerSkill.ts
│   │   │   ├── kbNavigatorSkill.ts
│   │   │   ├── queryGeneratorSkill.ts
│   │   │   ├── entityResolverSkill.ts
│   │   │   ├── evidenceSynthesizerSkill.ts
│   │   │   ├── gapAuditorSkill.ts
│   │   │   ├── dossierAssemblerSkill.ts
│   │   │   ├── gapDiscoverySkill.ts
│   │   │   ├── wikiWritebackSkill.ts
│   │   │   ├── statisticalProfilerSkill.ts
│   │   │   ├── wikiArchitectSkill.ts
│   │   │   ├── wikiPlanModifierSkill.ts
│   │   │   ├── wikiWriterSkill.ts
│   │   │   └── testConnectionSkill.ts
│   │   ├── agents/
│   │   │   ├── ingestionGraph.ts      - Pipeline A LangGraph definition
│   │   │   ├── investigationGraph.ts  - Pipeline B LangGraph (full loop with conditional edges)
│   │   │   └── queryExecutor.ts       - Non-LLM parallel query execution node
│   │   └── routes/
│   │       ├── ingest.ts      - Upload, profiling, plan retrieval, approval, wiki write
│   │       ├── investigate.ts - Tip submission, SSE stream, cancel/retry/fetch
│   │       ├── wiki.ts        - KB listing, page CRUD, rename, delete KB
│   │       └── source.ts      - SQLite table browsing, pagination
│   ├── data/
│   │   ├── graver.db          - SQLite database file (gitignored)
│   │   └── config.json        - Runtime configuration store (gitignored)
│   └── wiki/                  - Markdown knowledge bases (gitignored)
│       ├── CVR_Register_OpenSanctions_FtM/
│       ├── Danish_Arms_Export_Licenses/
│       ├── Defense_Procurement_Programs/
│       ├── Multi-Conflict_Civilian_Harm_Incidents/
│       └── findings/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts         - Dev server, /api proxy to localhost:3001
│   ├── tsconfig.json
│   ├── index.html
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.tsx           - React entry (StrictMode, Router, Providers)
│       ├── App.tsx            - Route definitions (/config, /ingest, /investigate, /wiki)
│       ├── index.css          - Tailwind directives and custom styles
│       ├── context/
│       │   ├── AppContext.tsx - Global React Context + useReducer
│       │   └── ConfigContext.tsx - Config load, update, distribution
│       ├── pages/
│       │   ├── ConfigPage.tsx
│       │   ├── IngestPage.tsx
│       │   ├── InvestigatePage.tsx
│       │   └── WikiPage.tsx
│       └── components/
│           ├── MainLayout.tsx        - Responsive layout, top nav, footer
│           ├── AgentStream.tsx       - SSE consumer, stage tracking, reasoning display
│           ├── StageProgress.tsx     - Pipeline diagram, round counter
│           ├── DossierViewer.tsx     - Collapsible dossier with confidence color-coding
│           ├── IngestionPanel.tsx    - Drag-drop upload, plan approval, table preview
│           ├── InvestigationPanel.tsx - Tip input, start/cancel/retry, results display
│           ├── AgentInventory.tsx    - Sidebar listing all agents with descriptions
│           ├── ErrorDisplay.tsx      - Retryable error card with stage context
│           └── SourceTableModal.tsx  - SQLite table browser modal with pagination
└── demo/                      - Reserved for demo dataset storage (currently empty)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- [Git LFS](https://git-lfs.com/) (required to clone the 1 GB SQLite database)
- An LLM API key (OpenAI, Anthropic, Gemini, OpenRouter, or custom endpoint)
- An Exa.ai API key (for web search)

### Installation

```bash
# Install dependencies for all workspaces
npm install

# Pull the large SQLite database tracked via Git LFS
git lfs pull

# Configure environment
# Edit backend/.env with your LLM and Exa API keys,
# or set them via the Config page in the UI after starting the app
```

### Development

```bash
# Start backend (port 3001) and frontend (port 5173) concurrently
npm run dev
```

The frontend Vite dev server proxies `/api` to `http://localhost:3001`.

### Production Build

```bash
# Build shared → backend → frontend
npm run build
```

### Type Checking

```bash
# Type-check all workspaces
npm run typecheck
```

---

## License

This is a prototype for research and demonstration purposes.
