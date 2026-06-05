# Sprint 8: Documentation & README Finalization

## STEP 0: Read the FRD and Implementation Plan

Before writing any documentation, re-read the entire Functional Requirements Document and Implementation Plan to ensure all architectural decisions, agent behaviors, and pipeline flows are accurately captured.

- **FRD_Graver_AI_Prototype.md** — All sections (1–7)
- **IMPLEMENTATION_PLAN_Graver_AI.md** — All sections and appendices
- **DATASETS.md** — The four pre-ingested demo knowledge bases (described below)

## Goal

Produce a comprehensive, permanent `README.md` that serves as the single source of truth for the project. The README must be understandable at multiple levels: elevator pitch for stakeholders, functional architecture for end-users, step-by-step flow for mid-level developers, and deep technical detail for senior developers.

The project currently contains **four pre-ingested demo knowledge bases** in both SQLite and the wiki file system. The README should mention these datasets as pre-loaded example data for demonstration and evaluation, but the app itself is a general-purpose investigative engine — not built for a single predefined case.

## Pre-Ingested Demo Knowledge Bases

The repository already contains four fully ingested knowledge bases. Before writing the README, review `DATASETS.md` for full provenance and methodology. The README must summarize:

1. **CVR_Register_OpenSanctions_FtM** (~2M records, real data from OpenSanctions Danish CVR Register) — Business registry with CVR numbers, industry classifications, addresses, and directors. The starting point for entity identification.

2. **Danish_Arms_Export_Licenses** (500 records, synthetic) — Individual export license records linking Danish companies to destination/end-user countries and product categories. Contains a mix of defense and non-defense exports across many companies and destinations.

3. **Defense_Procurement_Programs** (200 records, mixed real framework + synthetic components) — Program-level data for multinational weapons programs plus supplier-level component records linking Danish companies to specific programs.

4. **Multi-Conflict_Civilian_Harm_Incidents** (500 records, based on Airwars structure) — Civilian harm incidents across Gaza, Iraq/Syria, Yemen, Libya, and Ukraine. Tests the agent's ability to find relevant Gaza incidents (40% involve F-35I Adir) among hundreds of unrelated records.

The README should mention that a tip such as "Investigate whether Danish military equipment contributes to the conflict in Gaza" is one example of what a user could submit, but it should not present any specific investigation outcome as guaranteed or pre-scripted. 

## Implementation Tasks

### 1. Write the Comprehensive README.md

**Totally replace** the current `README.md` with a new comprehensive document. Do not keep the sprint status table or any other content from the previous README. The new README must be structured in **exactly** these five sections:

#### Section 1: Introduction (Elevator Pitch)

Write a concise, compelling paragraph (3–5 sentences) that answers:
- What is Graver-AI?
- Who is it for?
- What problem does it solve?
- What makes it unique?

Tone should be accessible to non-technical stakeholders. Use the Gaza investigation scenario as one example of what the tool *can* investigate, but frame it as an illustration of capability rather than the product's sole purpose. Note that the repository ships with four pre-ingested knowledge bases ready for demo and evaluation.

#### Section 2: End-User Friendly Functional Architecture

Describe what the system does from a user's perspective, not how it is built. Cover:
- The two main user journeys: Data Ingestion (Pipeline A) and Investigation (Pipeline B)
- What the user sees at each step (upload file → see statistics → approve wiki plan → submit tip → watch agents work → read dossier)
- The role of the wiki as a human-readable map on top of structured data
- The role of Exa.ai for supplemental web research
- Confidence ratings and source attribution
- **The pre-ingested demo datasets:** Briefly describe the four knowledge bases already loaded as example data for demonstration. Explain that they represent different domains (business registries, export licenses, defense procurement, conflict incidents) and are intended to test cross-source entity tracing, without asserting that any specific investigative chain is guaranteed to surface.

Use plain language. No code. No framework names. Include a simple text-based flow diagram if helpful.

#### Section 3: Step-by-Step Architecture Description (Mid-Level Developer)

This section must enable a mid-level developer to understand the agent flow, orchestration, rejection loop, and rejection criteria without reading source code.

Cover the following in detail:

**Pipeline A — Data Ingestion Flow:**
1. File upload → CSV/JSON parsing → SQLite table creation
2. Statistical Profiler Agent: what it receives (schema + sample), what it produces (SQL queries), why it does not use domain knowledge
3. SQL Execution Engine: non-LLM execution of profiler queries
4. Wiki Architect Agent: what it receives (aggregate results), what it produces (wiki plan)
5. Human Approval Gate: how the pipeline pauses, what the user sees, how approval resumes processing
6. Wiki Writer Agent: what it receives (approved plan + results), what it writes (markdown pages)

**Pipeline B — Investigation Flow:**
1. Tip Decomposer Agent: tip → 3-5 sub-claims with research questions and target entity types
2. KB Navigator Agent: sub-claim → ranked KB assignments with relevance scores (0.0–1.0) and justifications
3. Query Generator Agent: sub-claim + schema → SQL or Exa search parameters
4. Query Executor: parallel execution, SQLite vs. Exa, error isolation
5. Entity Resolver Agent: cross-source connection finding, contradiction flagging, confidence scoring
6. Evidence Synthesizer Agent: narrative summaries per sub-claim, confidence ratings (HIGH/MEDIUM/LOW)
7. Gap Auditor Agent: three checks (novelty, coverage, opportunity), three decisions (CONTINUE, STOP_COMPLETE, STOP_WITH_GAPS)
8. Loop Controller: conditional routing, cumulative context passing, hard cap at 5 rounds
9. Dossier Assembler Agent: final markdown with all required sections
10. Wiki Writeback Agent: findings page creation, index updates, bidirectional wikilinks

**The Rejection Loop and Rejection Criteria:**
- Explicitly describe what triggers a CONTINUE decision (new entities found, coverage gaps that can be filled, unqueried KBs with high opportunity)
- Explicitly describe what triggers STOP_COMPLETE (all sub-claims covered, no new connections expected)
- Explicitly describe what triggers STOP_WITH_GAPS (coverage holes that cannot be filled by available data)
- Explain the 5-round hard safety cap and why it exists
- Explain how cumulative context from previous rounds feeds into subsequent rounds

**Gap Discovery (Pipeline C):**
- When and why it fires (only when auditor returns STOP_WITH_GAPS and gaps are unfillable)
- What it produces (structured suggestion block: missing data, ideal KB type, public sources, recommendation)

**Demo Data Architecture:**
- Describe the four pre-ingested KBs at a high level (real vs synthetic, record counts, what they model)
- Explain that shared identifiers (CVR numbers, program names, platform types) allow the agent to attempt cross-source connections, but emphasize that the system discovers leads rather than following a scripted path
- Note that `demo/` is reserved for future dataset storage but is currently empty in the repo

#### Section 4: Detailed Technical Architecture (Senior Developer)

This section must enable a senior developer to fully understand the entirety of the app by reading this segment alone.

Cover:

**Stack:**
- TypeScript monorepo (npm workspaces)
- Backend: Node.js, Express, better-sqlite3, LangGraph.js, Zod
- Frontend: React 18+, Vite, TypeScript, Tailwind CSS
- Shared: `shared/types.ts` with cross-boundary types

**Data Architecture:**
- SQLite: one database file (`backend/data/graver.db`), separate tables per knowledge base, inferred types, foreign key detection by naming convention
- Wiki file system: markdown files on disk under `backend/wiki/`, directory per KB (`index.md`, entity pages, `findings/` global directory)
- Relationship: wiki describes the data; database contains the data; wiki is the agent-facing interface
- Config: JSON file at `backend/data/config.json` (masks API keys when returned to frontend)

**Agent Architecture:**
- `AgentSkill<Input, Output>` interface: name, description, inputSchema, outputSchema, execute(input, context)
- `AgentContext`: llmClient, exaClient, wikiStore, dbConnection, emitReasoning
- Skill files: standalone modules under `backend/src/skills/`, no dependency on Express routes or UI
- LangGraph nodes: thin wrappers that extract state → call skill → write state back
- Checkpointing: state persisted between rounds, enabling resume after human gates and failures

**LLM Client:**
- Unified interface for OpenAI, Anthropic, Gemini, OpenRouter, custom endpoints
- Request normalization per provider
- Streaming (async generator) and non-streaming modes
- Exponential backoff retry (max 3) on 429; typed errors (`LLMRateLimitError`, `LLMTimeoutError`, `LLMProviderError`)

**Exa Client:**
- Wrapper around Exa.ai REST API
- Methods: search, deepSearch, getContents
- Retry with jitter on failure
- Structured output schemas for consistent result shapes

**API Layer:**
- REST endpoints for config, ingest, investigate, wiki, source
- SSE endpoint (`/api/investigate/:id/stream`) for real-time agent events
- Event types: `stage_start`, `reasoning_chunk`, `stage_complete`, `query_executed`, `error`, `complete`, `heartbeat` (15s)
- Source routes (`/api/source/*`) for SQLite table browsing with pagination

**Frontend Architecture:**
- React Context + useReducer for global state (`AppContext`)
- Config context (`ConfigContext`) synced with `/api/config`
- Route-based panels: `/config`, `/ingest`, `/investigate`, `/wiki`
- Components: `MainLayout`, `ConfigPage`, `IngestPage`, `InvestigatePage`, `WikiPage`, `AgentStream`, `StageProgress`, `DossierViewer`, `IngestionPanel`, `InvestigationPanel`, `AgentInventory`, `ErrorDisplay`, `SourceTableModal`
- SSE handling: direct `EventSource` in `AgentStream` component
- Proxy: Vite proxies `/api` to backend

**Security:**
- API keys stored server-side only (`.env`, `backend/data/config.json`)
- `GET /api/config` masks keys (first 4 + `****` + last 4)
- HTTPS enforcement for custom endpoints
- No authentication, no multi-tenancy (personal prototype)

**Error Handling:**
- Pipeline stops on agent/API/query failure; error surfaced with stage context
- Retry from beginning supported (retry button restarts full investigation)
- State preserved up to failure point via checkpointing
- LLM: exponential backoff; Exa: jitter retry; SQL: syntax errors caught pre-execution

**Performance Targets:**
- Full investigation under 3 minutes
- SQLite queries under 100ms
- Exa deep search: 12–40s per call (UI shows progress)
- SSE heartbeat every 15s to prevent proxy timeouts

#### Section 5: Project Structure

Provide a complete directory tree with descriptions for every folder and significant file. Update it to reflect the actual built project. Include:

```
graver-ai/
├── package.json                 — Root workspace config, dev scripts
├── README.md                    — This file
├── SPRINT_INSTRUCTIONS.md       — Implementation anchor and sprint tracker
├── DATASETS.md                  — Demo dataset provenance and methodology
├── AGENTS.md                    — Agent guidance for AI coding assistants
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── types.ts                 — AgentSkill, AgentContext, all domain types
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                     — Runtime secrets (gitignored)
│   ├── src/
│   │   ├── server.ts            — Express entry, route mounting, graceful shutdown
│   │   ├── config/
│   │   │   ├── routes.ts        — Config CRUD endpoints, connection testing
│   │   │   └── store.ts         — Zod-validated JSON config file read/write, key masking
│   │   ├── db/
│   │   │   ├── connection.ts    — better-sqlite3 singleton with WAL mode
│   │   │   ├── migrate.ts       — Schema creation and migrations on startup
│   │   │   ├── parser.ts        — CSV/JSON → SQLite (type inference, FK detection)
│   │   │   └── execution.ts     — Safe SELECT-only query runner
│   │   ├── wiki/
│   │   │   └── store.ts         — Markdown file I/O (read, write, list, delete)
│   │   ├── llm/
│   │   │   ├── client.ts        — Unified LLM client with streaming and retry
│   │   │   └── errors.ts        — Typed LLM error classes
│   │   ├── exa/
│   │   │   └── client.ts        — Exa.ai API wrapper with jitter retry
│   │   ├── skills/              — Reusable agent skills (AgentSkill interface)
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
│   │   │   ├── ingestionGraph.ts      — Pipeline A LangGraph definition
│   │   │   ├── investigationGraph.ts  — Pipeline B LangGraph (full loop with conditional edges)
│   │   │   └── queryExecutor.ts       — Non-LLM parallel query execution node
│   │   └── routes/
│   │       ├── ingest.ts      — Upload, profiling, plan retrieval, approval, wiki write
│   │       ├── investigate.ts — Tip submission, SSE stream, cancel/retry/fetch
│   │       ├── wiki.ts        — KB listing, page CRUD, rename, delete KB
│   │       ├── source.ts      — SQLite table browsing, pagination
│   │       └── config.ts      — Configuration read/write endpoints (legacy, use config/routes.ts)
│   ├── data/
│   │   ├── graver.db          — SQLite database file (gitignored)
│   │   └── config.json        — Runtime configuration store (gitignored)
│   └── wiki/                  — Markdown knowledge bases (gitignored)
│       ├── CVR_Register_OpenSanctions_FtM/
│       ├── Danish_Arms_Export_Licenses/
│       ├── Defense_Procurement_Programs/
│       ├── Multi-Conflict_Civilian_Harm_Incidents/
│       └── findings/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts         — Dev server, /api proxy to localhost:3001
│   ├── tsconfig.json
│   ├── index.html
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.tsx           — React entry (StrictMode, Router, Providers)
│       ├── App.tsx            — Route definitions (/config, /ingest, /investigate, /wiki)
│       ├── index.css          — Tailwind directives and custom styles
│       ├── context/
│       │   ├── AppContext.tsx — Global React Context + useReducer
│       │   └── ConfigContext.tsx — Config load, update, distribution
│       ├── pages/
│       │   ├── ConfigPage.tsx
│       │   ├── IngestPage.tsx
│       │   ├── InvestigatePage.tsx
│       │   └── WikiPage.tsx
│       └── components/
│           ├── MainLayout.tsx        — Responsive layout, top nav, footer
│           ├── AgentStream.tsx       — SSE consumer, stage tracking, reasoning display
│           ├── StageProgress.tsx     — Pipeline diagram, round counter
│           ├── DossierViewer.tsx     — Collapsible dossier with confidence color-coding
│           ├── IngestionPanel.tsx    — Drag-drop upload, plan approval, table preview
│           ├── InvestigationPanel.tsx — Tip input, start/cancel/retry, results display
│           ├── AgentInventory.tsx    — Sidebar listing all agents with descriptions
│           ├── ErrorDisplay.tsx      — Retryable error card with stage context
│           └── SourceTableModal.tsx  — SQLite table browser modal with pagination
└── demo/                      — Reserved for demo dataset storage (currently empty)
```

### 2. Update SPRINT_INSTRUCTIONS.md

Mark Sprint 8 as **Complete** in [SPRINT_INSTRUCTIONS.md](../../SPRINT_INSTRUCTIONS.md).

Also update the [README.md](../../README.md) Sprint Status table to reflect that all 8 sprints are complete and the README has been replaced with permanent documentation.

### 3. Final Verification

- [ ] README.md contains all five required sections
- [ ] Section 1 is stakeholder-friendly (no jargon)
- [ ] Section 2 is end-user friendly (no code, no framework names) and describes the four pre-ingested demo datasets as example/evaluation data
- [ ] Section 3 explains the rejection loop, rejection criteria, and 5-round cap clearly
- [ ] Section 3 includes a subsection documenting the pre-ingested demo data architecture without treating any specific outcome as guaranteed
- [ ] Section 4 is comprehensive enough for a senior developer to onboard without reading source
- [ ] Section 4 correctly references `backend/src/config/routes.ts` and `backend/src/config/store.ts` (not `config.ts`)
- [ ] Section 4 mentions `source.ts` routes and `SourceTableModal` for table browsing
- [ ] Section 4 mentions `AgentInventory` for agent discovery
- [ ] Section 5 directory tree matches the actual project structure
- [ ] Section 5 correctly shows `backend/data/` and `backend/wiki/` as separate directories (not nested)
- [ ] Section 5 includes `wikiPlanModifierSkill.ts`, `llm/errors.ts`, and `index.css`
- [ ] All FRD-referenced concepts (AgentSkill, checkpointing, SSE, etc.) are accurately described
- [ ] No broken internal links
- [ ] DATASETS.md concepts are accurately summarized without presenting the Gaza chain as a guaranteed or pre-scripted result

## Sprint Completion Rules

### Do Not Proceed Without UAT Acceptance
You **must not** declare the project complete until **all** verification criteria above are checked off. The user must explicitly confirm UAT acceptance.

### Push to Main on UAT Acceptance
Once the user confirms that the UAT Criteria are accepted, push this sprint to the Main branch.

### Note on README Replacement

Unlike previous sprints (which updated the README sprint status table), **this sprint must totally replace `README.md`** with the comprehensive five-section documentation. Delete the old sprint status summary completely. The new README becomes the permanent project documentation.
