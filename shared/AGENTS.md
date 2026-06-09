# Shared — Agent Guidance Document

> Durable boundary: Cross-cutting TypeScript types, Zod schemas, and interfaces.

---

## Purpose

Cross-cutting TypeScript types, Zod schemas, and interfaces used by both backend and frontend.

## Ownership

- `types.ts` — single source of truth for all shared types and schemas
- `package.json` and `tsconfig.json` — workspace build configuration

## Local Contracts

- `types.ts` defines:
  - `AgentSkill<Input, Output>` interface and `AgentContext` interface
  - Client interfaces: `LLMClient`, `ExaClient`, `WikiStore`, `DatabaseConnection`
  - Domain types: `InvestigationState`, `Dossier`, `SubClaim`, `EvidenceBundle`, `Synthesis`, `ConnectionFinding`, etc.
  - Ingestion types: `IngestionJob`, `TableSchema`, `WikiPlan`, `ProfilingResult`, etc.
  - SSE event types: `StageEvent`, `ReasoningChunkEvent`, `QueryExecutedEvent`
- Build emits to `shared/dist/` and is referenced by backend and frontend via path mapping.

## Work Guidance

- All type changes must maintain compatibility with both backend and frontend.
- Build shared before backend/frontend: `npm run build -w shared`.
- Do not import backend- or frontend-specific modules here.
- Keep Zod schemas in sync with TypeScript interfaces.

## Verification

- `npm run build -w shared` compiles to `shared/dist/`.
- `npm run typecheck` validates cross-workspace type safety.

## Child DOX Index

None
