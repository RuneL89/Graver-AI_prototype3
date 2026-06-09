# Components — Agent Guidance Document

> Durable boundary: Reusable UI components for the Graver-AI frontend.

---

## Purpose

Reusable UI components for the Graver-AI frontend.

## Ownership

All `.tsx` files in this directory.

## Local Contracts

- `InvestigationPanel.tsx` — tip input, start/cancel/retry, results display
- `AgentStream.tsx` — SSE consumer, stage tracking, reasoning display, auto-scroll with pause/resume
- `DossierViewer.tsx` — collapsible dossier with confidence color-coding
- `StageProgress.tsx` — pipeline diagram of active/completed stages, round counter
- `IngestionPanel.tsx` — drag-drop upload, plan approval, profiling display, table preview
- `MainLayout.tsx` — top nav, footer, responsive layout
- `AgentInventory.tsx` — sidebar listing agents with descriptions
- `ErrorDisplay.tsx` — retryable error card with stage context
- `SourceTableModal.tsx` — SQLite table browser modal with pagination
- `KnowledgeGraph.tsx` — React Flow bubble-layout graph with click-to-highlight
- `InvestigationGraphModal.tsx` — modal fetching investigation and rendering `KnowledgeGraph`
- `SourceQueryModal.tsx` — modal showing original SQL query and result rows

## Work Guidance

- Keep components focused on presentation. Business logic belongs in pages or hooks.
- Use Tailwind for styling. Prefer utility classes over custom CSS.
- Modals should be dismissible and accessible.
- Graph components use React Flow.

## Verification

- `npm run typecheck -w frontend`
- Manual UI testing through browser

## Child DOX Index

None
