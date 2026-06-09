# Agents — Agent Guidance Document

> Durable boundary: LangGraph graph definitions that orchestrate investigation and ingestion pipelines.

---

## Purpose

LangGraph graph definitions that orchestrate the investigation and ingestion pipelines.

## Ownership

- `investigationGraph.ts` — main investigation graph topology and node wrappers
- `ingestionGraph.ts` — ingestion graph definition (profiler → sqlExecution → architect → humanGate → writer)
- `queryExecutor.ts` — parallel execution of SQLite and Exa queries

## Local Contracts

- `investigationGraph.ts` defines the graph: decomposer → navigator → generator → executor → resolver → synthesizer → auditor → [incrementRound/navigator loop or assembler → writeback].
- `ingestionGraph.ts` defines the graph but the primary ingestion flow uses async endpoints in `routes/ingest.ts`.
- `queryExecutor.ts` runs SQLite and Exa queries in parallel and returns evidence bundles plus error strings.
- State channels use `MemorySaver` as checkpointer. The `evidence` channel appends (`[...x, ...y]`), others replace (`y ?? x`).
- Recursion limit is 50. Max investigation rounds default to 5 (configurable).

## Work Guidance

- LangGraph nodes are thin wrappers: extract inputs from state, call skill, write outputs back.
- Nodes emit SSE events via `emitEvent` callback; skills emit reasoning via `emitReasoning`.
- Graph nodes must not contain business logic — delegate to skills.
- The investigation graph builds `wikiStore`, `llmClient`, and `exaClient` objects and passes them to skills.

## Verification

- Investigation end-to-end through UI.
- `npm run typecheck -w backend`

## Child DOX Index

None
