# Implementation Plan: Graver-AI Investigative Agent Prototype

## Document Purpose

This plan translates the Functional Requirements Document (FRD) into a sprint-structured build sequence for Kimi Code. Each sprint produces a verifiable increment. Kimi Code checks technical acceptance criteria before declaring a sprint complete. The user checks end-user acceptance criteria before approving the sprint and authorizing the next.

This plan is self-contained. All requirements reference the FRD by section number. Kimi Code should consult the FRD for full requirement context when implementing any item.

---

## Sprint Overview

| Sprint | Focus | FRD Sections |
|---|---|---|
| Sprint 1 | Project Foundation & Backend Shell | 4.1, 4.2, 4.4 |
| Sprint 2 | LLM Client, Exa Client & Configuration | 3.5, 4.6 |
| Sprint 3 | Data Ingestion Pipeline (Pipeline A) | 3.2, 5.1 |
| Sprint 4 | Investigation Pipeline Core (Pipeline B — Part 1) | 3.3, 5.2 (Decomposer through Executor) |
| Sprint 5 | Investigation Pipeline Completion (Pipeline B — Part 2) | 3.3, 5.2 (Resolver through Writeback), 3.6 |
| Sprint 6 | Real-Time Streaming & UI Panels | 3.4, 4.3 |
| Sprint 7 | Demo Data Preparation & End-to-End Integration | 6.1, 6.2, 8.2 |

---

## Cross-Cutting Principle: Reusable Agent Skill Files

Every agent in Pipeline A and Pipeline B must be implemented as a **reusable skill file** — a standalone TypeScript module that exports a single function conforming to a standard `AgentSkill` interface. The skill file contains:

- The LLM prompt template(s) used by the agent
- The input/output Zod schemas for type safety
- The core logic function that calls the LLM and parses the result
- No direct dependency on Express routes, LangGraph state, or UI components

LangGraph nodes are thin wrappers that import the skill file, extract inputs from graph state, call the skill function, and write outputs back to graph state. This separation ensures that agent skills can be tested independently, reused across pipelines, and understood without reading orchestration code.

The `AgentSkill` interface:

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

Kimi Code must create this interface in `shared/types.ts` and implement every agent as a module under `backend/src/skills/`.

---

## Sprint 1: Project Foundation & Backend Shell

### Goal
A running TypeScript monorepo with Express backend, Vite React frontend, SQLite database layer, and wiki file system layer. The dev server starts with one command.

### Implementation Tasks

1. **Initialize monorepo structure**
   - Create root `package.json` with npm workspaces or `concurrently` for orchestration
   - Create `backend/package.json` with Express, better-sqlite3, LangGraph.js, Zod, dotenv
   - Create `frontend/package.json` with React, Vite, TypeScript, Tailwind CSS
   - Create `shared/package.json` or `shared/types.ts` for cross-boundary types

2. **Configure TypeScript**
   - `backend/tsconfig.json` with Node.js target, strict mode, path aliases for `shared/`
   - `frontend/tsconfig.json` with DOM target, strict mode, path aliases for `shared/`
   - Root `tsconfig.json` for project references if using workspaces

3. **Set up dev scripts**
   - Root `npm run dev` starts backend on port 3001 and frontend on port 5173 concurrently
   - Frontend Vite config proxies `/api` to `http://localhost:3001`
   - Backend uses `cors` middleware for development

4. **Implement Express server shell** (`backend/src/server.ts`)
   - Express app with JSON parsing, CORS, and a health check route `GET /api/health`
   - Environment variable loading from `.env` via `dotenv`
   - Graceful shutdown handling

5. **Implement SQLite connection layer** (`backend/src/db/connection.ts`)
   - Initialize `better-sqlite3` with a file path from env (`DATABASE_PATH`)
   - Export a singleton database instance
   - Create a `migrate.ts` script that runs on server start to ensure required tables exist
   - Tables needed at minimum: `ingestion_jobs` (id, status, filename, schema_json, plan_json, approved_at)

6. **Implement wiki file system layer** (`backend/src/wiki/store.ts`)
   - Read and write markdown files to `WIKI_PATH` directory
   - Functions: `readPage(kbName, pagePath)`, `writePage(kbName, pagePath, content)`, `listPages(kbName)`, `deletePage(kbName, pagePath)`
   - Ensure directory creation on write
   - No LLM logic here — pure file I/O

7. **Create shared types** (`shared/types.ts`)
   - `AgentContext` interface
   - `AgentSkill` interface
   - `IngestionJob` type
   - `InvestigationState` type (for LangGraph state)
   - `SubClaim`, `ResearchPlan`, `EvidenceBundle`, `Synthesis`, `Dossier` types
   - `WikiPage` type

8. **Create frontend shell** (`frontend/src/App.tsx`)
   - Minimal React app with React Router (or simple state-based routing)
   - Three placeholder routes: `/config`, `/ingest`, `/investigate`
   - Global React Context with `useReducer` for state management
   - A simple navigation bar linking between routes

### Technical Acceptance Criteria (Kimi Code checks)

- [ ] `npm install` at root installs all dependencies without errors
- [ ] `npm run dev` starts both backend and frontend in one terminal
- [ ] `GET /api/health` returns `{ status: "ok" }`
- [ ] SQLite database file is created automatically on first run
- [ ] `migrate.ts` creates the `ingestion_jobs` table
- [ ] Wiki store can write and read a markdown file and the file appears on disk
- [ ] Frontend loads at `http://localhost:5173` and navigation between routes works
- [ ] Frontend proxy successfully forwards `/api/health` to the backend
- [ ] `shared/types.ts` is importable from both backend and frontend without type errors
- [ ] `npx tsc --noEmit` passes in both `backend/` and `frontend/` directories

### End-User Acceptance Criteria (User verifies)

- [ ] I can open the project in GitHub Codespaces
- [ ] I can run `npm run dev` and see both services start
- [ ] I can open the frontend URL and see a working navigation bar
- [ ] I can call `/api/health` and get a response
- [ ] I can see the SQLite database file and wiki directory created on disk

---

## Sprint 2: LLM Client, Exa Client & Configuration

### Goal
The backend can call LLM APIs and Exa APIs. The frontend has a configuration screen where API keys are entered, validated, and persisted.

### Implementation Tasks

1. **Implement LLM client** (`backend/src/llm/client.ts`)
   - Unified interface supporting OpenAI, Anthropic, Gemini, OpenRouter, and custom endpoints
   - Request body normalization per provider
   - Exponential backoff retry on 429/rate-limit errors
   - Max retry count: 3
   - Timeout handling
   - Streaming support: return an async generator that yields reasoning chunks
   - Non-streaming support: return full response
   - Error types: `LLMRateLimitError`, `LLMTimeoutError`, `LLMProviderError`

2. **Implement Exa client** (`backend/src/exa/client.ts`)
   - Wrapper around Exa.ai REST API
   - Methods:
     - `search(params: ExaSearchParams)` — standard/instant search
     - `deepSearch(params: ExaDeepSearchParams)` — deep reasoning search
     - `getContents(urls: string[], options?)` — contents extraction
   - Handles API key from env var `EXA_API_KEY`
   - Retries with jitter on failure
   - Returns typed responses matching Exa API schemas

3. **Implement configuration backend** (`backend/src/config.ts`)
   - Load API keys and provider settings from `.env` and `localStorage`-equivalent file
   - `GET /api/config` returns current settings (without exposing full API keys — mask all but last 4 characters)
   - `POST /api/config` validates and saves settings
   - Validation: API key format checks, endpoint URL format checks, HTTPS enforcement

4. **Implement configuration frontend** (`frontend/src/components/ConfigScreen.tsx`)
   - Form with fields: LLM provider dropdown, API key input, model name input, Exa API key input
   - "Test Connection" buttons for LLM and Exa that make validation calls
   - Save button persists to backend
   - Display masked current settings on load
   - Error messages for invalid inputs or failed test calls

5. **Implement configuration context** (`frontend/src/context/ConfigContext.tsx`)
   - Load config on app mount
   - Provide config values to all components
   - Handle config updates

6. **Create test skill** (`backend/src/skills/testConnectionSkill.ts`)
   - A simple reusable skill that sends a "hello world" prompt to the LLM and returns the response
   - Used by the "Test Connection" button

### Technical Acceptance Criteria (Kimi Code checks)

- [ ] LLM client can send a non-streaming prompt to OpenAI and receive a structured response
- [ ] LLM client can send a streaming prompt and yield reasoning chunks
- [ ] LLM client retries 3 times on 429 errors with exponential backoff
- [ ] LLM client throws typed errors for timeout and provider failures
- [ ] Exa client can execute a standard search and return results
- [ ] Exa client can execute a deep search and return results
- [ ] Exa client can fetch contents from a URL
- [ ] `GET /api/config` returns masked keys
- [ ] `POST /api/config` validates and saves settings
- [ ] Config screen renders all fields and test buttons
- [ ] Test connection buttons call the backend and display success/failure
- [ ] `npx tsc --noEmit` passes

### End-User Acceptance Criteria (User verifies)

- [ ] I can open the configuration screen
- [ ] I can enter my OpenAI API key and model name
- [ ] I can enter my Exa API key
- [ ] I can click "Test LLM Connection" and see a successful response
- [ ] I can click "Test Exa Connection" and see a successful response
- [ ] I can save the configuration and see it persisted after refresh
- [ ] I can see that my API keys are masked in the UI

---

## Sprint 3: Data Ingestion Pipeline (Pipeline A)

### Goal
A complete Pipeline A: upload CSV/JSON → statistical profiling → wiki plan proposal → user approval → wiki generation. All agents implemented as reusable skills.

### Implementation Tasks

1. **Implement file upload endpoint** (`backend/src/routes/ingest.ts`)
   - `POST /api/ingest/upload` — accepts multipart/form-data with CSV or JSON
   - Validates file type and size
   - Parses CSV/JSON into SQLite table with inferred types
   - Stores file metadata in `ingestion_jobs` table with status `uploaded`
   - Returns job ID

2. **Implement CSV/JSON parser** (`backend/src/db/parser.ts`)
   - Detect delimiter, headers, and column types (TEXT, INTEGER, REAL, DATE)
   - Detect potential foreign keys by naming convention (`*_id`, `*_cvr`)
   - Create table with sanitized column names
   - Insert all rows in a transaction

3. **Implement Statistical Profiler skill** (`backend/src/skills/statisticalProfilerSkill.ts`)
   - **FRD Reference: Section 5.1 — Pipeline A: Data Ingestion**
   - Input: schema metadata (column names, types, foreign keys) + 50 sample rows
   - LLM prompt: "Given this schema and sample, propose 5-8 SQL profiling queries to understand the data landscape. Consider: frequency distributions, numerical outliers, null rates, temporal patterns, cross-column correlations."
   - Output: array of SQL query strings with descriptions
   - No domain knowledge in prompt — purely statistical reasoning

4. **Implement SQL Execution engine** (`backend/src/db/execution.ts`)
   - **FRD Reference: Section 5.1 — SQL Execution Engine (non-LLM)**
   - Input: array of SQL queries
   - Execute each against the uploaded table
   - Return results as JSON arrays
   - Handle SQL errors gracefully

5. **Implement Wiki Architect skill** (`backend/src/skills/wikiArchitectSkill.ts`)
   - **FRD Reference: Section 5.1 — Wiki Architect Agent**
   - Input: SQL results (aggregate data only, no raw rows)
   - LLM prompt: "Given these statistical results, draft a wiki structure plan. Include: index.md content with capability map, proposed entity/segment pages based on statistical notability, cross-KB linkage hints. Do not assume domain knowledge."
   - Output: `WikiPlan` object with `indexContent`, `proposedPages[]`, `linkageHints[]`

6. **Implement plan approval endpoints** (`backend/src/routes/ingest.ts`)
   - `GET /api/ingest/plan/:jobId` — returns the draft plan
   - `POST /api/ingest/approve/:jobId` — accepts approved/modified plan, updates job status to `approved`, triggers Wiki Writer
   - `POST /api/ingest/reject/:jobId` — rejects plan, allows re-profiling

7. **Implement Wiki Writer skill** (`backend/src/skills/wikiWriterSkill.ts`)
   - **FRD Reference: Section 5.1 — Wiki Writer Agent**
   - Input: approved plan + raw statistical results
   - LLM prompt: "Generate polished markdown pages from this plan. Use proper headers, wikilinks, and citation anchors back to database tables."
   - Output: array of `WikiPage` objects with `path` and `content`
   - Writes pages to wiki file system via `wikiStore`

8. **Implement ingestion frontend** (`frontend/src/components/IngestionPanel.tsx`)
   - Drag-and-drop file upload
   - Display upload progress and job status
   - Display proposed wiki plan in a readable format
   - Approve/reject/modify buttons for the plan
   - Display generated wiki pages after approval

9. **Implement LangGraph ingestion graph** (`backend/src/agents/ingestionGraph.ts`)
   - Nodes: Upload → Profiler → SQL Execution → Architect → Human Gate → Writer
   - Human gate is a breakpoint: graph pauses, state is checkpointed, waits for external approval
   - After approval, graph resumes from Writer node

### Technical Acceptance Criteria (Kimi Code checks)

- [ ] CSV upload creates a SQLite table with correct types and all rows inserted
- [ ] JSON upload creates a SQLite table with correct types and all rows inserted
- [ ] Statistical Profiler skill returns 5-8 SQL queries for any uploaded dataset
- [ ] SQL Execution engine runs all queries and returns aggregate results
- [ ] Wiki Architect skill generates a plan with index.md and proposed pages
- [ ] Plan approval API accepts modifications and stores the approved plan
- [ ] Wiki Writer skill generates markdown pages that are written to disk
- [ ] LangGraph graph pauses at human gate and resumes after approval
- [ ] Ingestion panel shows upload, plan, and result stages
- [ ] `npx tsc --noEmit` passes

### End-User Acceptance Criteria (User verifies)

- [ ] I can drag and drop a CSV file into the ingestion panel
- [ ] I can see the file being processed and a job ID assigned
- [ ] I can see a proposed wiki plan with an index.md draft and proposed pages
- [ ] I can approve the plan (or modify it before approving)
- [ ] I can see the generated wiki pages in the wiki viewer after approval
- [ ] I can verify that markdown files exist on disk in the wiki directory

---

## Sprint 4: Investigation Pipeline Core (Pipeline B — Part 1)

### Goal
The first half of Pipeline B is functional: tip submission → decomposition → KB navigation → query generation → query execution. The user can submit a tip and see queries running against knowledge bases.

### Implementation Tasks

1. **Implement Tip Decomposer skill** (`backend/src/skills/tipDecomposerSkill.ts`)
   - **FRD Reference: Section 5.2 — Tip Decomposer Agent**
   - Input: raw tip text + all KB index pages (markdown strings)
   - LLM prompt: "Given this tip and the available knowledge bases, break it into 3-5 independently researchable sub-claims. Each sub-claim must include: a focused research question, target entity type, and suggested KBs based on the index pages."
   - Output: `ResearchPlan` with `subClaims[]`
   - Emits reasoning chunks via `emitReasoning`

2. **Implement KB Navigator skill** (`backend/src/skills/kbNavigatorSkill.ts`)
   - **FRD Reference: Section 5.2 — KB Navigator Agent**
   - Input: one sub-claim + all KB index pages
   - LLM prompt: "Read the index pages. Match this sub-claim to the most relevant knowledge bases. Return a ranked list with relevance scores (0.0-1.0) and justifications. Consider both local SQLite KBs and Exa.ai for web research."
   - Output: array of `KBAssignment` objects with `kbName`, `sourceType` ('sqlite' | 'exa'), `relevanceScore`, `justification`
   - Emits reasoning chunks

3. **Implement Query Generator skill** (`backend/src/skills/queryGeneratorSkill.ts`)
   - **FRD Reference: Section 5.2 — Query Generator Agent**
   - Input: sub-claim + assigned KB schema (for SQLite) or search context (for Exa)
   - LLM prompt: "Generate precise queries for this sub-claim. For SQLite: write SQL with JOINs, filters, aggregations. For Exa: write semantic query string, category, date filters, output_schema, and domain restrictions."
   - Output: array of `Query` objects — either `SqlQuery` or `ExaQuery`
   - Emits reasoning chunks

4. **Implement Query Executor** (`backend/src/agents/queryExecutor.ts`)
   - **FRD Reference: Section 5.2 — Query Executor (non-LLM)**
   - Input: array of `Query` objects
   - For SQL queries: execute via better-sqlite3, return result sets as JSON
   - For Exa queries: call Exa client, return results as JSON
   - Parallel execution via `Promise.all`
   - Error handling: if one query fails, others continue; failures are logged

5. **Implement investigation submission endpoint** (`backend/src/routes/investigate.ts`)
   - `POST /api/investigate` — accepts `{ tip: string }`, creates investigation job, starts LangGraph
   - Returns investigation ID
   - `GET /api/investigate/:id/stream` — SSE endpoint streaming agent events

6. **Implement investigation graph (first half)** (`backend/src/agents/investigationGraph.ts`)
   - Nodes: Decomposer → KB Navigator → Query Generator → Query Executor
   - Each node is a thin wrapper importing the skill file
   - State carries: `tip`, `subClaims[]`, `kbAssignments[]`, `queries[]`, `results[]`
   - Checkpointing after each node
   - SSE events emitted at each stage transition

7. **Implement Agent Stream frontend** (`frontend/src/components/AgentStream.tsx`)
   - **FRD Reference: Section 3.4 — Real-Time Agent Monitoring**
   - Connects to SSE endpoint
   - Displays stage start/completion events
   - Displays reasoning chunks in real time
   - Shows which agent is currently active
   - Shows which knowledge bases were selected

8. **Implement investigation panel** (`frontend/src/components/InvestigationPanel.tsx`)
   - Text input for tip entry
   - "Run Investigation" button
   - Displays AgentStream when running
   - Displays query results in a structured format after execution

### Technical Acceptance Criteria (Kimi Code checks)

- [ ] Tip Decomposer skill breaks any tip into 3-5 sub-claims with research questions
- [ ] KB Navigator skill assigns relevant KBs with scores and justifications
- [ ] Query Generator skill produces valid SQL for SQLite KBs
- [ ] Query Generator skill produces valid Exa parameters for web research
- [ ] Query Executor runs all queries in parallel and returns structured results
- [ ] Investigation graph runs Decomposer → Navigator → Generator → Executor without errors
- [ ] SSE stream emits stage events and reasoning chunks
- [ ] Agent Stream component renders real-time events correctly
- [ ] Investigation panel accepts tips and displays results
- [ ] `npx tsc --noEmit` passes

### End-User Acceptance Criteria (User verifies)

- [ ] I can enter a tip in the investigation panel
- [ ] I can click "Run Investigation" and see the agent stream start
- [ ] I can see the decomposer breaking the tip into sub-claims in real time
- [ ] I can see the KB navigator selecting knowledge bases with relevance scores
- [ ] I can see the query generator writing SQL and Exa parameters
- [ ] I can see the query executor running queries and returning results
- [ ] I can see all reasoning text as it is produced

---

## Sprint 5: Investigation Pipeline Completion (Pipeline B — Part 2)

### Goal
The second half of Pipeline B is functional: entity resolution → evidence synthesis → gap auditing → loop control → dossier assembly → wiki writeback. The full investigation loop runs end-to-end, produces a dossier, and handles the 5-round safety cap.

### Implementation Tasks

1. **Implement Entity Resolver skill** (`backend/src/skills/entityResolverSkill.ts`)
   - **FRD Reference: Section 5.2 — Entity Resolver Agent**
   - Input: result sets from multiple KBs (SQLite + Exa)
   - LLM prompt: "Find shared identifiers across these result sets: CVR numbers, names, dates, locations. Flag potential matches, aliases, and cross-references. Note when Exa results confirm or contradict local database results."
   - Output: `ConnectionFindings` with `connections[]`, `contradictions[]`, `confidenceScores`
   - Writes connection findings to wiki

2. **Implement Evidence Synthesizer skill** (`backend/src/skills/evidenceSynthesizerSkill.ts`)
   - **FRD Reference: Section 5.2 — Evidence Synthesizer Agent**
   - Input: raw results + entity pages + connection findings
   - LLM prompt: "Assemble evidence into narrative summaries per sub-claim. Assign confidence: HIGH (direct evidence, multiple sources), MEDIUM (inferred), LOW (single source, circumstantial). Flag contradictions."
   - Output: `Synthesis` with `entries[]` (one per sub-claim)

3. **Implement Gap Auditor skill** (`backend/src/skills/gapAuditorSkill.ts`)
   - **FRD Reference: Section 5.2 — Gap Auditor Agent**
   - Input: full synthesis + investigation state + round history
   - LLM prompt: "Evaluate: novelty (new entities/connections this round?), coverage (all sub-claims have evidence?), opportunity (unqueried KBs that might help?). Return decision: CONTINUE, STOP_COMPLETE, or STOP_WITH_GAPS."
   - Output: `AuditDecision` with `decision`, `reasoning`, `suggestedQueries[]` (if CONTINUE)

4. **Implement Loop Controller** (`backend/src/agents/loopController.ts`)
   - **FRD Reference: Section 5.2 — Loop Controller (non-LLM)**
   - LangGraph conditional edge
   - If auditor says CONTINUE and round < 5: route back to KB Navigator with cumulative context
   - If auditor says STOP_COMPLETE or STOP_WITH_GAPS: route to Dossier Assembler
   - If round == 5: force route to Dossier Assembler regardless of auditor
   - Increment round counter

5. **Implement Dossier Assembler skill** (`backend/src/skills/dossierAssemblerSkill.ts`)
   - **FRD Reference: Section 3.3 — Dossier Content**
   - Input: full synthesis + audit trail + all evidence bundles + investigation state
   - LLM prompt: "Format a structured investigation dossier with: Executive Summary, Findings by Sub-Claim, Cross-Source Connections, Evidence Gaps, Confidence Summary, Source Attribution, Suggested Next Steps."
   - Output: `Dossier` object with markdown content and structured sections

6. **Implement Gap Discovery Suggestions** (`backend/src/skills/gapDiscoverySkill.ts`)
   - **FRD Reference: Section 3.6 — Gap Discovery Suggestions**
   - Input: gap characterization from auditor
   - LLM prompt: "Suggest what data is missing, what type of knowledge base would contain it, and what public sources might exist."
   - Output: `GapSuggestions` appended to dossier

7. **Implement Wiki Writeback skill** (`backend/src/skills/wikiWritebackSkill.ts`)
   - **FRD Reference: Section 5.2 — Wiki Writeback Agent**
   - Input: dossier
   - Creates `findings/{investigation-id}.md` in the global findings directory
   - Updates relevant KB index pages to note new cross-KB connections
   - Maintains bidirectional wikilinks

8. **Complete investigation graph** (`backend/src/agents/investigationGraph.ts`)
   - Add nodes: Entity Resolver → Synthesizer → Gap Auditor → Dossier Assembler → Wiki Writeback
   - Connect conditional edge from Auditor to either loop back or proceed
   - Ensure checkpointing persists state across rounds
   - Ensure SSE events cover all new stages

9. **Implement Dossier Viewer** (`frontend/src/components/DossierViewer.tsx`)
   - **FRD Reference: Section 3.3 — Dossier Rendering**
   - Renders markdown dossier with collapsible sections
   - Executive Summary always expanded
   - Findings, Connections, Gaps, Attribution as collapsible sections
   - Confidence ratings displayed with color coding (HIGH = green, MEDIUM = yellow, LOW = red)
   - Source attribution as clickable links or query references

10. **Implement Wiki Viewer** (`frontend/src/components/WikiViewer.tsx`)
    - Browse wiki pages by knowledge base
    - Render markdown with wikilink navigation
    - Click wikilinks to navigate between pages
    - Display page metadata (last modified, source KB)

### Technical Acceptance Criteria (Kimi Code checks)

- [ ] Entity Resolver finds connections across SQLite and Exa results
- [ ] Evidence Synthesizer produces narrative summaries with confidence ratings
- [ ] Gap Auditor correctly identifies when to continue, stop complete, or stop with gaps
- [ ] Loop Controller routes correctly: continues up to 5 rounds, stops at cap
- [ ] Dossier Assembler produces all required sections (Executive Summary, Findings, Connections, Gaps, Confidence, Attribution, Next Steps)
- [ ] Gap Discovery Suggestions are appended when gaps exist
- [ ] Wiki Writeback creates findings pages and updates indexes
- [ ] Full investigation graph runs end-to-end from tip to dossier
- [ ] Dossier Viewer renders all sections with collapsible UI
- [ ] Wiki Viewer displays pages and navigates wikilinks
- [ ] `npx tsc --noEmit` passes

### End-User Acceptance Criteria (User verifies)

- [ ] I can submit a tip and the full investigation runs automatically
- [ ] I can see the agent stream through all stages: decomposition, navigation, queries, resolution, synthesis, auditing, assembly
- [ ] I can see the investigation loop through multiple rounds when the auditor decides to continue
- [ ] I can see the final dossier with all sections
- [ ] I can expand/collapse sections in the dossier
- [ ] I can see confidence ratings color-coded
- [ ] I can see source attribution for every claim
- [ ] I can see gap suggestions when evidence is missing
- [ ] I can browse the wiki and see new findings pages from the investigation
- [ ] The investigation stops within 5 rounds

---

## Sprint 6: Real-Time Streaming & UI Polish

### Goal
The UI is polished, real-time streaming is robust, and all panels are functional and visually coherent.

### Implementation Tasks

1. **Enhance SSE streaming** (`backend/src/routes/investigate.ts`)
   - **FRD Reference: Section 3.4 — Real-Time Agent Monitoring**
   - Ensure SSE connection stays alive during long-running operations
   - Heartbeat events every 15 seconds to prevent timeout
   - Proper cleanup on client disconnect
   - Event types: `stage_start`, `reasoning_chunk`, `stage_complete`, `query_executed`, `error`, `complete`

2. **Enhance Agent Stream component** (`frontend/src/components/AgentStream.tsx`)
   - Display active agent name with status indicator (running, completed, error)
   - Display selected knowledge bases per sub-claim
   - Display when Exa is queried vs. SQLite
   - Display query parameters (sanitized — no API keys)
   - Auto-scroll to latest event
   - Pause/resume scroll on user interaction

3. **Implement stage progress visualization** (`frontend/src/components/StageProgress.tsx`)
   - Visual pipeline diagram showing all stages
   - Completed stages in green, active in blue, pending in gray
   - Round counter display ("Round 2 of 5")
   - Click completed stages to expand their outputs

4. **Polish ingestion panel** (`frontend/src/components/IngestionPanel.tsx`)
   - Better file drop zone with visual feedback
   - Display table preview after upload (first 10 rows)
   - Display statistical results in charts or tables
   - Plan approval with inline editing

5. **Polish investigation panel** (`frontend/src/components/InvestigationPanel.tsx`)
   - Tip input with character counter
   - Recent tips dropdown
   - Run button with loading state
   - Cancel button (abort signal)

6. **Add error handling UI** (`frontend/src/components/ErrorDisplay.tsx`)
   - Display errors with stage context
   - "Retry from failed stage" button
   - Error details expandable

7. **Add global layout** (`frontend/src/components/MainLayout.tsx`)
   - Responsive layout with sidebar navigation
   - Collapsible sidebar on mobile
   - Status bar showing backend connection state

8. **Style with Tailwind CSS**
   - Consistent color scheme (slate/blue for primary, green/yellow/red for confidence)
   - Typography scale for readability
   - Spacing and borders for visual hierarchy
   - Dark mode support (optional but nice)

### Technical Acceptance Criteria (Kimi Code checks)

- [ ] SSE stream stays alive for investigations lasting over 2 minutes
- [ ] Heartbeat events prevent proxy timeouts
- [ ] Agent Stream shows all event types correctly
- [ ] Stage Progress visualizes the pipeline accurately
- [ ] Ingestion panel displays table previews and statistical results
- [ ] Investigation panel has cancel functionality
- [ ] Error display shows retry option
- [ ] Main layout is responsive
- [ ] Tailwind styles are consistent across all components
- [ ] `npx tsc --noEmit` passes

### End-User Acceptance Criteria (User verifies)

- [ ] I can watch a full investigation stream without the connection dropping
- [ ] I can see which agent is running, which KBs are selected, and when Exa is called
- [ ] I can see a visual pipeline diagram showing progress
- [ ] I can click on completed stages to review their outputs
- [ ] I can cancel a running investigation
- [ ] I can retry from a failed stage if an error occurs
- [ ] I can see a table preview after uploading a CSV
- [ ] I can edit the wiki plan inline before approving
- [ ] The UI looks polished and professional on both desktop and mobile

---

## Sprint 7: Demo Data Preparation & End-to-End Integration

### Goal
All four demo knowledge bases are ingested, the Gaza tip produces the expected chain, the integrity check passes, and the demo is ready.

### Implementation Tasks

1. **Prepare kb-business dataset**
   - **FRD Reference: Section 6.1 — kb-business**
   - Load real Danish CVR data from OpenSanctions
   - Filter to a manageable subset (e.g., 1,000-5,000 companies) including defense-related entries
   - Ensure Terma or similar defense companies are present
   - Export as CSV for ingestion

2. **Prepare kb-licenses dataset**
   - **FRD Reference: Section 6.1 — kb-licenses**
   - Create synthetic export license records
   - Schema: license_number, exporter_cvr, product_category, destination_country, end_user_country, issue_date, value_usd
   - Include records linking Terma's CVR to F-35 component exports to US with Israel as end-user
   - Include other realistic records for noise (exports to other countries, other products)
   - Export as CSV

3. **Prepare kb-procurement dataset**
   - **FRD Reference: Section 6.1 — kb-procurement**
   - Load real F-35 program framework data (program name, participating countries)
   - Create synthetic component records: component_name, program_id, supplier_cvr, contract_value, delivery_date
   - Link Terma's CVR to specific F-35 components
   - Include other suppliers for noise
   - Export as CSV

4. **Prepare kb-conflicts dataset**
   - **FRD Reference: Section 6.1 — kb-conflicts**
   - Extract real subset from Airwars Gaza incident database
   - Schema: incident_id, date, location, description, munition_type, platform_type, operator_country, source_url
   - Include incidents where platform_type references F-35 or Israeli Air Force
   - Export as CSV

5. **Ingest all four knowledge bases**
   - Run Pipeline A for each dataset
   - Approve each wiki plan
   - Verify wiki pages are generated correctly
   - Verify index pages describe the data accurately

6. **Run end-to-end Gaza test**
   - Submit tip: "Investigate whether Danish military equipment contributes to the conflict in Gaza"
   - Verify the agent:
     - Selects kb-business, kb-licenses, kb-procurement, kb-conflicts
     - Finds Terma in kb-business
     - Finds export licenses linking Terma to F-35 components to US/Israel
     - Finds F-35 components in kb-procurement
     - Finds Gaza incidents in kb-conflicts
     - Resolves the cross-KB chain
     - Produces a dossier with the expected connections
   - Verify the dossier contains all required sections

7. **Run integrity check (cheese exports)**
   - **FRD Reference: Section 6.2 — Data Integrity**
   - Submit tip: "Investigate Danish cheese exports to France"
   - Verify the agent:
     - Queries kb-business for dairy companies
     - Queries kb-licenses for food exports
     - Finds no defense procurement link
     - Finds no conflict incidents
     - Returns a dossier stating "No significant connections found"
   - Verify the agent does NOT return the Gaza story

8. **Run Exa integration test**
   - Submit a tip that requires supplemental web research
   - Verify Exa deep search is called
   - Verify web evidence is cross-referenced with database evidence
   - Verify Exa results appear in the dossier with proper attribution

9. **Performance validation**
   - Gaza investigation completes in under 3 minutes
   - All SQLite queries execute in under 100ms
   - Agent stream renders smoothly without UI freezing

10. **Documentation**
    - Update README with setup instructions
    - Document the demo flow
    - Document API endpoints

### Technical Acceptance Criteria (Kimi Code checks)

- [ ] All four KBs are ingested and wiki pages are generated
- [ ] Gaza tip produces a dossier with the Terma → F-35 → Israel → Gaza chain
- [ ] Cheese exports tip produces a "no significant connections" dossier
- [ ] Exa integration test shows web evidence in the dossier
- [ ] Gaza investigation completes in under 3 minutes
- [ ] No SQLite query exceeds 100ms
- [ ] All tests pass without errors
- [ ] README contains accurate setup instructions
- [ ] `npx tsc --noEmit` passes

### End-User Acceptance Criteria (User verifies)

- [ ] I can see all four knowledge bases in the wiki viewer with proper index pages
- [ ] I can submit the Gaza tip and receive a complete dossier within 3 minutes
- [ ] The dossier shows the expected chain of connections
- [ ] I can submit the cheese exports tip and receive a negative result
- [ ] The negative result does not mention Gaza, F-35, or Terma
- [ ] I can see Exa web evidence in the dossier when relevant
- [ ] The demo flow works smoothly from start to finish
- [ ] I am confident showing this to Torben on June 19

---

## Appendix A: File Structure Target

```
graver-ai/
├── package.json
├── README.md
├── .env.example
├── shared/
│   └── types.ts              # All shared types, AgentSkill interface
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts         # Express entry point
│   │   ├── config.ts         # Env var loading, settings management
│   │   ├── db/
│   │   │   ├── connection.ts # better-sqlite3 setup
│   │   │   ├── migrate.ts    # Schema creation
│   │   │   ├── parser.ts     # CSV/JSON → SQLite
│   │   │   └── execution.ts  # SQL query runner
│   │   ├── wiki/
│   │   │   └── store.ts      # Markdown file I/O
│   │   ├── llm/
│   │   │   └── client.ts     # Unified LLM client
│   │   ├── exa/
│   │   │   └── client.ts     # Exa.ai API wrapper
│   │   ├── skills/           # REUSABLE AGENT SKILLS
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
│   │   │   ├── wikiWriterSkill.ts
│   │   │   └── testConnectionSkill.ts
│   │   ├── agents/
│   │   │   ├── ingestionGraph.ts      # Pipeline A LangGraph
│   │   │   ├── investigationGraph.ts  # Pipeline B LangGraph
│   │   │   └── queryExecutor.ts       # Non-LLM execution node
│   │   └── routes/
│   │       ├── ingest.ts      # Upload, plan, approve endpoints
│   │       ├── investigate.ts # Tip submission, SSE stream
│   │       ├── wiki.ts        # Wiki CRUD endpoints
│   │       └── config.ts      # Configuration endpoints
│   └── data/
│       ├── sqlite/            # .gitignore'd database files
│       └── wiki/              # .gitignore'd markdown files
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx
│       ├── api/
│       │   └── client.ts      # Fetch + SSE handler
│       ├── context/
│       │   ├── AppContext.tsx # Global React Context + reducer
│       │   └── ConfigContext.tsx
│       └── components/
│           ├── MainLayout.tsx
│           ├── ConfigScreen.tsx
│           ├── IngestionPanel.tsx
│           ├── InvestigationPanel.tsx
│           ├── AgentStream.tsx
│           ├── StageProgress.tsx
│           ├── DossierViewer.tsx
│           ├── WikiViewer.tsx
│           └── ErrorDisplay.tsx
└── demo/
    ├── kb-business.csv        # OpenSanctions CVR data
    ├── kb-licenses.csv        # Synthetic license records
    ├── kb-procurement.csv     # Mixed real/synthetic procurement
    └── kb-conflicts.csv       # Airwars Gaza subset
```

## Appendix B: Skill File Template

Every skill file must follow this pattern:

```typescript
// backend/src/skills/exampleSkill.ts
import { z } from 'zod';
import { AgentSkill, AgentContext } from '../../shared/types';

const inputSchema = z.object({
  // define inputs
});

const outputSchema = z.object({
  // define outputs
});

export const exampleSkill: AgentSkill<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
  name: 'ExampleSkill',
  description: 'What this skill does and when to use it',
  inputSchema,
  outputSchema,

  async execute(input, context) {
    const { llmClient, emitReasoning } = context;

    // Build prompt
    const prompt = `...`;

    // Stream reasoning if available
    if (emitReasoning) {
      emitReasoning('Starting example skill...');
    }

    // Call LLM
    const response = await llmClient.complete({
      model: context.config.model,
      messages: [{ role: 'user', content: prompt }],
      // streaming handled by client
    });

    // Parse and validate
    const parsed = outputSchema.parse(JSON.parse(response.content));

    return parsed;
  }
};
```
