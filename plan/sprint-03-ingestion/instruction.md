# Sprint 3: Data Ingestion Pipeline (Pipeline A)

## STEP 0: Read the FRD

Before writing any code, read the relevant sections of the Functional Requirements Document:

- **FRD Section 3.2** — Core Feature: Data Ingestion (upload, profiling, wiki plan, approval, generation)
- **FRD Section 5.1** — Pipeline A: Data Ingestion (Statistical Profiler, SQL Execution Engine, Wiki Architect, Wiki Writer)
- **FRD Section 4.4** — Data Layer (SQLite + wiki file system relationship)

Refer to [FRD_Graver_AI_Prototype.md](../../FRD_Graver_AI_Prototype.md) for full requirement context.

## Goal

A complete Pipeline A: upload CSV/JSON → statistical profiling → wiki plan proposal → user approval → wiki generation. All agents implemented as reusable skills.

## Implementation Tasks

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
   - Follows the `AgentSkill` interface

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
   - Follows the `AgentSkill` interface

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
   - Follows the `AgentSkill` interface

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

## Technical Acceptance Criteria (Kimi Code checks)

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

## End-User Acceptance Criteria (User verifies)

- [ ] I can drag and drop a CSV file into the ingestion panel
- [ ] I can see the file being processed and a job ID assigned
- [ ] I can see a proposed wiki plan with an index.md draft and proposed pages
- [ ] I can approve the plan (or modify it before approving)
- [ ] I can see the generated wiki pages in the wiki viewer after approval
- [ ] I can verify that markdown files exist on disk in the wiki directory

## Sprint Completion Rules

### Do Not Proceed Without UAT Acceptance
You **must not** begin Sprint 4 until **all** Technical Acceptance Criteria and **all** End-User Acceptance Criteria above are checked off. The user must explicitly confirm UAT acceptance.

### Push to Main on UAT Acceptance
Once the user confirms that the UAT Criteria are accepted, push this sprint to the Main branch.

### Update README.md
After completing this sprint and before pushing to Main, update the [README.md](../../README.md) Sprint Status table to mark Sprint 3 as **Complete** and reflect the current project state.
