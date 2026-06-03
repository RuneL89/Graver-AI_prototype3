# Sprint 8: Documentation & README Finalization

## STEP 0: Read the FRD and Implementation Plan

Before writing any documentation, re-read the entire Functional Requirements Document and Implementation Plan to ensure all architectural decisions, agent behaviors, and pipeline flows are accurately captured.

- **FRD_Graver_AI_Prototype.md** — All sections (1–7)
- **IMPLEMENTATION_PLAN_Graver_AI.md** — All sections and appendices

## Goal

Produce a comprehensive, permanent `README.md` that serves as the single source of truth for the project. The README must be understandable at multiple levels: elevator pitch for stakeholders, functional architecture for end-users, step-by-step flow for mid-level developers, and deep technical detail for senior developers.

## Implementation Tasks

### 1. Write the Comprehensive README.md

**Totally replace** the current `README.md` with a new comprehensive document. Do not keep the sprint status table or any other content from the previous README. The new README must be structured in **exactly** these five sections:

#### Section 1: Introduction (Elevator Pitch)

Write a concise, compelling paragraph (3–5 sentences) that answers:
- What is Graver-AI?
- Who is it for?
- What problem does it solve?
- What makes it unique?

Tone should be accessible to non-technical stakeholders. Mention the Gaza investigation example as concrete context.

#### Section 2: End-User Friendly Functional Architecture

Describe what the system does from a user's perspective, not how it is built. Cover:
- The two main user journeys: Data Ingestion (Pipeline A) and Investigation (Pipeline B)
- What the user sees at each step (upload file → see statistics → approve wiki plan → submit tip → watch agents work → read dossier)
- The role of the wiki as a human-readable map on top of structured data
- The role of Exa.ai for supplemental web research
- Confidence ratings and source attribution

Use plain language. No code. No framework names. Include a simple text-based flow diagram if helpful.

#### Section 3: Step-by-Step Architecture Description (Mid-Level Developer)

This section must enable a mid-level developer to understand the agent flow, orchestration, rejection loop, and rejection criteria without reading source code.

Cover the following in detail:

**Pipeline A — Data Ingestion Flow:**
1. File upload → CSV/JSON parsing → SQLite table creation
2. Statistical Profiler Agent: what it receives (schema + sample), what it produces (SQL queries), why it does not use domain knowledge
3. SQL Execution Engine: non-LLM execution of profiler queries
4. Wiki Architect Agent: what it receives (aggregate results), what it produces (wiki plan)
5. Human Approval Gate: how the graph pauses, what the user sees, how approval resumes the graph
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

#### Section 4: Detailed Technical Architecture (Senior Developer)

This section must enable a senior developer to fully understand the entirety of the app by reading this segment alone.

Cover:

**Stack:**
- TypeScript monorepo (npm workspaces)
- Backend: Node.js, Express, better-sqlite3, LangGraph.js, Zod
- Frontend: React 18+, Vite, TypeScript, Tailwind CSS
- Shared: `shared/types.ts` with cross-boundary types

**Data Architecture:**
- SQLite: one database file, separate tables per knowledge base, inferred types, foreign key detection by naming convention
- Wiki file system: markdown files on disk, directory per KB (`index.md`, `entities/`, `findings/`), global `findings/` directory
- Relationship: wiki describes the data; database contains the data; wiki is the agent-facing interface

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
- Exponential backoff retry (max 3) on 429; typed errors (LLMRateLimitError, LLMTimeoutError, LLMProviderError)

**Exa Client:**
- Wrapper around Exa.ai REST API
- Methods: search, deepSearch, getContents
- Retry with jitter on failure
- Structured output schemas for consistent result shapes

**API Layer:**
- REST endpoints for config, ingest, investigate, wiki
- SSE endpoint (`/api/investigate/:id/stream`) for real-time agent events
- Event types: stage_start, reasoning_chunk, stage_complete, query_executed, error, complete, heartbeat (15s)

**Frontend Architecture:**
- React Context + useReducer for global state
- Route-based panels: /config, /ingest, /investigate
- Components: ConfigScreen, IngestionPanel, InvestigationPanel, AgentStream, StageProgress, DossierViewer, WikiViewer, ErrorDisplay, MainLayout
- SSE handling: direct EventSource in AgentStream component
- Proxy: Vite proxies `/api` to backend

**Security:**
- API keys stored server-side only (.env, local config file)
- `GET /api/config` masks keys (all but last 4 chars)
- HTTPS enforcement for custom endpoints
- No authentication, no multi-tenancy (personal prototype)

**Error Handling:**
- Pipeline stops on agent/API/query failure; error surfaced with stage context
- Retry from failed stage supported
- State preserved up to failure point via checkpointing
- LLM: exponential backoff; Exa: jitter retry; SQL: syntax errors caught pre-execution

**Performance Targets:**
- Full investigation under 3 minutes
- SQLite queries under 100ms
- Exa deep search: 12–40s per call (UI shows progress)
- SSE heartbeat every 15s to prevent proxy timeouts

#### Section 5: Project Structure

Provide a complete directory tree with descriptions for every folder and significant file. Use the Implementation Plan Appendix A as the baseline but update it to reflect the actual built project. Include:

```
graver-ai/
├── package.json               — Root workspace config, dev scripts
├── README.md                  — This file
├── SPRINT_INSTRUCTIONS.md     — Implementation anchor and sprint tracker
├── .env.example               — Required environment variables template
├── shared/
│   └── types.ts               — AgentSkill, AgentContext, all domain types
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts          — Express entry, middleware, graceful shutdown
│   │   ├── config.ts          — Env loading, settings management, key masking
│   │   ├── db/
│   │   │   ├── connection.ts  — better-sqlite3 singleton
│   │   │   ├── migrate.ts     — Schema creation on startup
│   │   │   ├── parser.ts      — CSV/JSON → SQLite (types, FK detection)
│   │   │   └── execution.ts   — SQL query runner (non-LLM)
│   │   ├── wiki/
│   │   │   └── store.ts       — Markdown file I/O (read, write, list, delete)
│   │   ├── llm/
│   │   │   └── client.ts      — Unified LLM client with streaming and retry
│   │   ├── exa/
│   │   │   └── client.ts      — Exa.ai API wrapper
│   │   ├── skills/            — Reusable agent skills (AgentSkill interface)
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
│   │   │   ├── ingestionGraph.ts      — Pipeline A LangGraph (upload → profiler → execution → architect → human gate → writer)
│   │   │   ├── investigationGraph.ts  — Pipeline B LangGraph (full loop with conditional edges)
│   │   │   ├── queryExecutor.ts       — Non-LLM query execution node
│   │   │   └── loopController.ts      — Non-LLM conditional routing logic
│   │   └── routes/
│   │       ├── ingest.ts      — Upload, plan retrieval, approval/rejection endpoints
│   │       ├── investigate.ts — Tip submission, SSE stream endpoint
│   │       ├── wiki.ts        — Wiki CRUD endpoints
│   │       └── config.ts      — Configuration read/write endpoints
│   └── data/
│       ├── sqlite/            — .gitignore'd database files
│       └── wiki/              — .gitignore'd markdown files
├── frontend/
│   ├── package.json
│   ├── vite.config.ts         — Dev server, /api proxy to localhost:3001
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx            — Router, context providers
│       ├── api/
│       │   └── client.ts      — Fetch wrapper + SSE handler
│       ├── context/
│       │   ├── AppContext.tsx — Global React Context + useReducer
│       │   └── ConfigContext.tsx — Config load, update, distribution
│       └── components/
│           ├── MainLayout.tsx       — Responsive layout, sidebar, status bar
│           ├── ConfigScreen.tsx     — API keys, provider selection, test buttons
│           ├── IngestionPanel.tsx   — Drag-drop upload, plan approval, wiki preview
│           ├── InvestigationPanel.tsx — Tip input, run/cancel controls
│           ├── AgentStream.tsx      — SSE connection, real-time reasoning display
│           ├── StageProgress.tsx    — Visual pipeline diagram, round counter
│           ├── DossierViewer.tsx    — Collapsible markdown dossier rendering
│           ├── WikiViewer.tsx       — Markdown browsing, wikilink navigation
│           └── ErrorDisplay.tsx     — Stage-context errors, retry controls
└── demo/
    ├── kb-business.csv        — Danish CVR subset (OpenSanctions)
    ├── kb-licenses.csv        — Synthetic export license records
    ├── kb-procurement.csv     — F-35 program component records
    └── kb-conflicts.csv       — Airwars Gaza incident subset
```

### 2. Update SPRINT_INSTRUCTIONS.md

Mark Sprint 8 as **Complete** in [SPRINT_INSTRUCTIONS.md](../../SPRINT_INSTRUCTIONS.md).

### 3. Final Verification

- [ ] README.md contains all five required sections
- [ ] Section 1 is stakeholder-friendly (no jargon)
- [ ] Section 2 is end-user friendly (no code, no framework names)
- [ ] Section 3 explains the rejection loop, rejection criteria, and 5-round cap clearly
- [ ] Section 4 is comprehensive enough for a senior developer to onboard without reading source
- [ ] Section 5 directory tree matches the actual project structure
- [ ] All FRD-referenced concepts (AgentSkill, checkpointing, SSE, etc.) are accurately described
- [ ] No broken internal links

## Sprint Completion Rules

### Do Not Proceed Without UAT Acceptance
You **must not** declare the project complete until **all** verification criteria above are checked off. The user must explicitly confirm UAT acceptance.

### Push to Main on UAT Acceptance
Once the user confirms that the UAT Criteria are accepted, push this sprint to the Main branch.

### Note on README Replacement

Unlike previous sprints (which updated the README sprint status table), **this sprint must totally replace `README.md`** with the comprehensive five-section documentation. Delete the old sprint status summary completely. The new README becomes the permanent project documentation.
