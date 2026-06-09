# Pages — Agent Guidance Document

> Durable boundary: Route-level page components for the Graver-AI frontend.

---

## Purpose

Route-level page components for the Graver-AI frontend.

## Ownership

All `.tsx` files in this directory.

## Local Contracts

- `ConfigPage.tsx` — LLM/Exa provider setup, testing, saving
- `IngestPage.tsx` — upload + ingestion agent inventory sidebar
- `InvestigatePage.tsx` — investigation panel + agent inventory sidebar
- `WikiPage.tsx` — wiki viewer/CRUD with markdown rendering, wikilink navigation, source table modal

## Work Guidance

- Pages compose components and manage route-level state.
- Keep page components focused on layout and data flow; presentation details belong in `components/`.

## Verification

- `npm run typecheck -w frontend`
- Manual UI testing through browser

## Child DOX Index

None
