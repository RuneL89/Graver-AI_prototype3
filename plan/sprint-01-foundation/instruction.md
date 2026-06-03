# Sprint 1: Project Foundation & Backend Shell

## STEP 0: Read the FRD

Before writing any code, read the relevant sections of the Functional Requirements Document:

- **FRD Section 4.1** — System Overview (TypeScript full-stack, Express + React/Vite)
- **FRD Section 4.2** — Backend architecture and responsibilities
- **FRD Section 4.4** — Data Layer (SQLite + markdown wiki file system)

Refer to [FRD_Graver_AI_Prototype.md](../../FRD_Graver_AI_Prototype.md) for full requirement context.

## Goal

A running TypeScript monorepo with Express backend, Vite React frontend, SQLite database layer, and wiki file system layer. The dev server starts with one command.

## Cross-Cutting Principle: Reusable Agent Skill Files

As specified in the Implementation Plan, every agent in Pipeline A and Pipeline B must eventually be implemented as a **reusable skill file** — a standalone TypeScript module that exports a single function conforming to a standard `AgentSkill` interface. In this sprint, create the shared types that define this interface so all future sprints build on a common contract.

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

Create this interface in `shared/types.ts`.

## Implementation Tasks

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

## Technical Acceptance Criteria (Kimi Code checks)

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

## End-User Acceptance Criteria (User verifies)

- [ ] I can open the project in GitHub Codespaces
- [ ] I can run `npm run dev` and see both services start
- [ ] I can open the frontend URL and see a working navigation bar
- [ ] I can call `/api/health` and get a response
- [ ] I can see the SQLite database file and wiki directory created on disk

## Sprint Completion Rules

### Do Not Proceed Without UAT Acceptance
You **must not** begin Sprint 2 until **all** Technical Acceptance Criteria and **all** End-User Acceptance Criteria above are checked off. The user must explicitly confirm UAT acceptance.

### Push to Main on UAT Acceptance
Once the user confirms that the UAT Criteria are accepted, push this sprint to the Main branch.

### Update README.md
After completing this sprint and before pushing to Main, update the [README.md](../../README.md) Sprint Status table to mark Sprint 1 as **Complete** and reflect the current project state.
