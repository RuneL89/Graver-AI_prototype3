# Graver-AI Investigative Agent Prototype

> **Status**: Sprint 5 Complete — Full Investigation Pipeline with entity resolution, evidence synthesis, gap auditing, loop control, dossier assembly, and wiki writeback live on `main`

## What is Graver-AI?

Graver-AI is a browser-based research acceleration tool for investigative journalists. A user enters a plain-language tip. The system decomposes it into researchable sub-claims, queries multiple structured knowledge bases in parallel (SQLite databases and Exa.ai web search), discovers cross-source connections, and produces a structured investigation dossier with full source attribution and confidence ratings. It is an agentic investigation engine — not a fact-checker, not a summarizer — designed to discover leads from structured data.

## Current Capabilities

- **Unified LLM Client** — OpenAI, Anthropic, Gemini, OpenRouter, and custom endpoints with configurable base URLs
- **Exa.ai Integration** — Web search with configurable search type (instant / fast / deep)
- **Data Ingestion** — Upload CSV/JSON → automatic SQLite table creation with type inference, statistical profiling, and LLM-generated wiki documentation
- **Wiki System** — Auto-generated markdown knowledge base with index pages, clickable wikilinks (`[[path|Text]]`), and source citations (`[source: table_name]`)
- **Wiki Viewer/CRUD** — Sidebar navigation, rendered markdown (GFM), rename/delete pages & KBs, create new pages, custom display names
- **Source Table Popups** — Click any `[source: table_name]` citation to browse the underlying SQLite data with pagination
- **Plan Approval Flow** — Ingestion plans require user approval before wiki generation; supports modifying plans or targeting existing KBs for merge
- **Investigation Pipeline Core** — Submit a plain-language tip → watch agents decompose it into sub-claims, navigate KBs with relevance scoring, generate SQL/Exa queries, and execute them in real time via SSE streaming
- **Entity Resolution** — Discovers shared identifiers across SQLite and Exa results, flags contradictions, and writes connection findings
- **Evidence Synthesis** — Assembles evidence into narrative summaries per sub-claim with HIGH/MEDIUM/LOW confidence ratings
- **Gap Auditing & Loop Control** — Evaluates novelty, coverage, and opportunity; routes back for up to 5 rounds or stops with gaps
- **Dossier Assembly** — Formats structured dossiers with Executive Summary, Findings, Connections, Gaps, Confidence, Attribution, and Next Steps
- **Gap Discovery Suggestions** — Appends actionable suggestions for missing data sources when evidence is insufficient
- **Wiki Writeback** — Files investigation findings as markdown pages and updates KB index pages with cross-KB connections
- **Dossier Viewer** — Collapsible UI with confidence color-coding and source attribution links

## Sprint Plan Status

| Sprint | Focus | Status |
|---|---|---|
| Sprint 1 | Project Foundation & Backend Shell | ✅ Complete |
| Sprint 2 | LLM Client, Exa Client & Configuration | ✅ Complete |
| Sprint 3 | Data Ingestion Pipeline (Pipeline A) | ✅ Complete |
| Sprint 4 | Investigation Pipeline Core (Pipeline B — Part 1) | ✅ Complete |
| Sprint 5 | Investigation Pipeline Completion (Pipeline B — Part 2) | ✅ Complete |
| Sprint 6 | Real-Time Streaming & UI Panels | Not Started |
| Sprint 7 | Demo Data Preparation & End-to-End Integration | Not Started |
| Sprint 8 | Documentation & README Finalization | Not Started |

## How to Implement

See [SPRINT_INSTRUCTIONS.md](./SPRINT_INSTRUCTIONS.md) for the full implementation guide, sprint progression rules, and directions to sprint-specific instructions.

## Documents

- [Functional Requirements Document (FRD)](./FRD_Graver_AI_Prototype.md)
- [Implementation Plan](./IMPLEMENTATION_PLAN_Graver_AI.md)
- [Sprint Instructions](./SPRINT_INSTRUCTIONS.md)
