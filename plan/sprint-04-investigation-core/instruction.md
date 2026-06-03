# Sprint 4: Investigation Pipeline Core (Pipeline B — Part 1)

## STEP 0: Read the FRD

Before writing any code, read the relevant sections of the Functional Requirements Document:

- **FRD Section 3.3** — Core Feature: Investigation (tip submission through query execution)
- **FRD Section 5.2** — Pipeline B: Investigation (Tip Decomposer through Query Executor)
- **FRD Section 3.4** — Core Feature: Real-Time Agent Monitoring (SSE streaming requirements)
- **FRD Section 4.5** — Agent Orchestration (LangGraph.js StateGraph, checkpointing)

Refer to [FRD_Graver_AI_Prototype.md](../../FRD_Graver_AI_Prototype.md) for full requirement context.

## Goal

The first half of Pipeline B is functional: tip submission → decomposition → KB navigation → query generation → query execution. The user can submit a tip and see queries running against knowledge bases.

## Implementation Tasks

1. **Implement Tip Decomposer skill** (`backend/src/skills/tipDecomposerSkill.ts`)
   - **FRD Reference: Section 5.2 — Tip Decomposer Agent**
   - Input: raw tip text + all KB index pages (markdown strings)
   - LLM prompt: "Given this tip and the available knowledge bases, break it into 3-5 independently researchable sub-claims. Each sub-claim must include: a focused research question, target entity type, and suggested KBs based on the index pages."
   - Output: `ResearchPlan` with `subClaims[]`
   - Emits reasoning chunks via `emitReasoning`
   - Follows the `AgentSkill` interface

2. **Implement KB Navigator skill** (`backend/src/skills/kbNavigatorSkill.ts`)
   - **FRD Reference: Section 5.2 — KB Navigator Agent**
   - Input: one sub-claim + all KB index pages
   - LLM prompt: "Read the index pages. Match this sub-claim to the most relevant knowledge bases. Return a ranked list with relevance scores (0.0-1.0) and justifications. Consider both local SQLite KBs and Exa.ai for web research."
   - Output: array of `KBAssignment` objects with `kbName`, `sourceType` ('sqlite' | 'exa'), `relevanceScore`, `justification`
   - Emits reasoning chunks
   - Follows the `AgentSkill` interface

3. **Implement Query Generator skill** (`backend/src/skills/queryGeneratorSkill.ts`)
   - **FRD Reference: Section 5.2 — Query Generator Agent**
   - Input: sub-claim + assigned KB schema (for SQLite) or search context (for Exa)
   - LLM prompt: "Generate precise queries for this sub-claim. For SQLite: write SQL with JOINs, filters, aggregations. For Exa: write semantic query string, category, date filters, output_schema, and domain restrictions."
   - Output: array of `Query` objects — either `SqlQuery` or `ExaQuery`
   - Emits reasoning chunks
   - Follows the `AgentSkill` interface

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

## Technical Acceptance Criteria (Kimi Code checks)

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

## End-User Acceptance Criteria (User verifies)

- [ ] I can enter a tip in the investigation panel
- [ ] I can click "Run Investigation" and see the agent stream start
- [ ] I can see the decomposer breaking the tip into sub-claims in real time
- [ ] I can see the KB navigator selecting knowledge bases with relevance scores
- [ ] I can see the query generator writing SQL and Exa parameters
- [ ] I can see the query executor running queries and returning results
- [ ] I can see all reasoning text as it is produced

## Sprint Completion Rules

### Do Not Proceed Without UAT Acceptance
You **must not** begin Sprint 5 until **all** Technical Acceptance Criteria and **all** End-User Acceptance Criteria above are checked off. The user must explicitly confirm UAT acceptance.

### Push to Main on UAT Acceptance
Once the user confirms that the UAT Criteria are accepted, push this sprint to the Main branch.

### Update README.md
After completing this sprint and before pushing to Main, update the [README.md](../../README.md) Sprint Status table to mark Sprint 4 as **Complete** and reflect the current project state.
