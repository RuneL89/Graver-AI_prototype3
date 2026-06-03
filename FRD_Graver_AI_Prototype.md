# Functional Requirements Document: Graver-AI Investigative Agent Prototype

## 1. Background and Need

Investigative journalism relies on connecting facts across disconnected data sources. A journalist investigating whether Danish military equipment contributes to the conflict in Gaza must trace a chain across business registries, export licenses, defense procurement records, and conflict incident databases. Today, this requires manual cross-referencing, specialized query skills, and hours of tedious work.

The Graver-AI prototype is a browser-based research acceleration tool that automates this cross-source tracing using a multi-agent AI architecture. A journalist or reader enters a plain-language tip. The system decomposes it into researchable sub-claims, queries multiple structured knowledge bases in parallel, discovers cross-source connections, and produces a structured investigation dossier with full source attribution and confidence ratings.

The prototype is not a fact-checker. It is not a document summarizer. It is an agentic investigation engine that discovers leads from structured data, with the explicit design goal that the same agentic skills could find other connections and leads when pointed at different datasets.

## 2. Product Vision

The system is built on three architectural principles:

First, a two-layer data architecture. Structured data lives in SQLite databases for fast, reliable queries. A semantic LLM Wiki layer sits on top, containing index pages, entity pages, and findings pages in markdown. The wiki gives agents a human-readable map of what data exists and what questions each knowledge base can answer, without requiring the agent to query the full database blindly.

Second, an agentic investigation loop. An LLM-driven planning agent reads the tip, reads the wiki index pages, and decides which knowledge bases to query and what entities to look for. The agent runs in rounds, each round producing new evidence or connections. A gap auditor evaluates whether the investigation should continue, stop, or flag gaps. The loop has a hard safety cap of five rounds.

Third, supplemental web research via Exa.ai. When local knowledge bases have gaps or when the tip involves recent events not captured in static data, the agent queries Exa.ai for semantic web search, deep-reasoning synthesis, and structured content extraction. Web evidence and database evidence flow through the same pipeline and are cross-referenced identically.

## 3. Functional Requirements

### 3.1 User Personas

Primary user: Investigative journalist or researcher who needs to trace entities across structured databases without writing SQL queries.

Secondary user: Newsroom editor or reader who submits a tip and receives a structured dossier indicating whether the tip merits human investigation.

### 3.2 Core Feature: Data Ingestion

The system must accept CSV and JSON file uploads through a drag-and-drop interface. Upon upload, the system parses the file into typed SQLite tables with inferred column types and detected foreign keys.

The system then runs a statistical profiling phase. An LLM agent receives only the schema and a small sample of rows. It proposes SQL aggregate queries to understand the data landscape: frequency distributions, numerical outliers, null rates, temporal patterns, and cross-column correlations. These queries execute against the full dataset via pure code.

An LLM wiki architect agent receives the statistical results and drafts a proposed wiki structure. This includes an index.md page describing what the knowledge base contains, what columns mean, what questions it can answer, what segments exist, and what connections to other knowledge bases are possible. It also proposes entity pages or segment pages for statistically notable groups (top-N outliers, dominant categories, null groups, temporal spikes).

The proposed plan is presented to the user in a UI panel. The user must explicitly approve, modify, or reject the plan before any wiki pages are written. The user can request additional pages, suggest different segmentation, or ask questions about the proposal.

After approval, an LLM wiki writer agent generates the final markdown pages with proper wikilinks, citation anchors back to database tables, and structured headers.

The system must support lazy entity generation. When an investigation later queries a specific entity not yet in the wiki, the system queries the database for all matching records, summarizes them into a new entity page, and caches it.

### 3.3 Core Feature: Investigation

The system must accept a free-text investigative tip through a text input field. Upon submission, the system runs the investigation pipeline.

The tip decomposer agent breaks the tip into three to five independently researchable sub-claims. Each sub-claim is phrased as a focused research question and includes a target entity type.

The knowledge base navigator agent reads the index.md page of every available knowledge base. It matches each sub-claim against the capability maps described in the indexes. It assigns a relevance score and justification for each knowledge base. It decides whether to query local SQLite databases, Exa.ai, or both.

The query generator agent receives each sub-claim and the schema of its assigned knowledge bases. For SQLite databases, it generates precise SQL queries with joins, filters, and aggregations. For Exa.ai, it generates search parameters including semantic query strings, category filters, date ranges, domain restrictions, and structured output schemas.

The query executor runs the generated queries. SQLite queries execute via the database driver. Exa queries execute via HTTP API. Results are returned in structured format.

The entity resolver agent receives result sets from all queried sources. It looks for shared identifiers across knowledge bases: CVR numbers, names, dates, locations. It flags potential matches, aliases, and cross-references. It writes connection findings to the wiki. It explicitly notes when Exa results confirm or contradict local database results.

The evidence synthesizer agent assembles all query results, entity pages, and connection findings into a narrative summary per sub-claim. It assigns confidence ratings: HIGH for direct evidence from multiple sources, MEDIUM for inferred connections, LOW for single-source or circumstantial evidence. It flags contradictions between sources.

The gap auditor agent evaluates the cumulative investigation state. It runs three checks: novelty (did this round produce new entities or connections), coverage (does every sub-claim have at least some evidence), and opportunity (are there unqueried knowledge bases or Exa searches that might yield productive evidence). It returns a decision: CONTINUE, STOP_COMPLETE, or STOP_WITH_GAPS.

The investigation loop is controlled by a conditional router. If the auditor returns CONTINUE, the system initiates a new round. The planning agent in subsequent rounds receives the cumulative findings as context and generates refined or new sub-claims. The loop repeats up to a maximum of five rounds, after which the system stops regardless of the auditor's decision.

If the auditor returns STOP_COMPLETE or STOP_WITH_GAPS, the dossier assembler agent formats the final investigation dossier. The dossier contains: an executive summary, findings organized by sub-claim, cross-source connections with confidence ratings, evidence gaps explicitly noted, a confidence summary for the overall investigation, full source attribution linking every claim to its database query or Exa search, and suggested next steps for human follow-up.

The dossier is rendered as structured markdown in the UI with collapsible sections.

After dossier completion, the wiki writeback agent files investigation results as new findings pages in the wiki. It updates knowledge base indexes to note new cross-KB connections. This makes the wiki compound over time.

### 3.4 Core Feature: Real-Time Agent Monitoring

The UI must display the full agentic flow in real time. The user sees:

- A list of available knowledge bases with their index summaries
- Which knowledge bases the navigator agent selected for each sub-claim
- Which agents are active at any moment
- The reasoning text produced by each LLM agent as it runs
- When Exa.ai is queried and what parameters were used
- Stage progress indicators showing completed, active, and pending stages
- Any errors or stalls with retry indicators

This is delivered via Server-Sent Events from the backend to the frontend. The stream includes stage start events, reasoning chunks, stage completion events with outputs, and error events.

### 3.5 Core Feature: Configuration

The system must provide a configuration screen accessible from the main UI. The user enters:

- LLM provider selection (OpenAI, Anthropic, Gemini, OpenRouter, or custom endpoint)
- LLM API key
- LLM model name
- Exa.ai API key
- Optional: default parameters for investigation depth, max rounds, or timeout settings

Settings are validated before use. Invalid API keys or unreachable endpoints surface clear error messages.

### 3.6 Core Feature: Gap Discovery Suggestions

When the gap auditor identifies missing evidence that cannot be filled by available knowledge bases or Exa searches, the system appends a structured suggestion block to the bottom of the dossier. This block lists:

- What data is missing (e.g., end-user verification records for re-exported components)
- What type of knowledge base would contain it (e.g., import customs database, end-user certificate registry)
- What public sources might exist (e.g., Israeli Ministry of Defense procurement disclosures, UN arms trade reports)
- A recommendation to the user to acquire and ingest such a dataset for deeper investigation

This is not an active pipeline that automatically searches for and ingests new data. It is a suggestion engine that surfaces actionable next steps.

## 4. Technical Architecture

### 4.1 System Overview

The system is a TypeScript full-stack application. The backend is an Express server running on Node.js. The frontend is a React application built with Vite. Both are developed in the same repository with shared TypeScript types.

Communication between frontend and backend uses REST for standard requests and Server-Sent Events for real-time agent progress streaming.

### 4.2 Backend

The backend is an Express server with the following responsibilities:

- HTTP API endpoints for file upload, wiki plan retrieval and approval, investigation submission, wiki page access, and configuration
- Server-Sent Events endpoint for investigation streaming
- SQLite database management via better-sqlite3
- Markdown wiki file system management
- LangGraph.js agent orchestration for all three pipelines
- LLM client abstraction supporting multiple providers with retry logic
- Exa.ai client wrapper for search and content extraction

The backend stores SQLite database files on the local file system in a data directory. It stores markdown wiki files on the local file system in a wiki directory. Both directories are excluded from version control.

### 4.3 Frontend

The frontend is a React application with the following panels:

- Configuration screen for API keys and provider settings
- Ingestion panel for file upload, statistical profile review, and wiki plan approval
- Investigation panel for tip entry, run control, and live progress display
- Agent stream panel showing real-time reasoning, stage transitions, and active agent status
- Dossier viewer rendering the final markdown dossier with collapsible sections
- Wiki viewer for browsing markdown pages and navigating wikilinks

State management uses React Context with useReducer. API calls use a thin fetch wrapper. SSE connections are managed directly in components that require streaming.

### 4.4 Data Layer

Structured data is stored in SQLite. Each knowledge base is a separate SQLite database file or a separate set of tables within a single database, with explicit schema definitions. Foreign keys link tables within a knowledge base. Cross-knowledge-base connections are discovered at query time by the entity resolver using shared identifiers.

The LLM Wiki is stored as markdown files on disk. Each knowledge base has its own subdirectory containing index.md, an entities subdirectory, and a findings subdirectory. A global findings directory contains investigation results that span multiple knowledge bases.

The wiki is the agent-facing interface to the data. The database is the queryable source of truth. The wiki describes the data; the database contains the data.

### 4.5 Agent Orchestration

Agent orchestration uses LangGraph.js StateGraph. Each pipeline is a separate graph with defined nodes and conditional edges.

The investigation graph includes nodes for decomposition, KB navigation, query generation, query execution, entity resolution, synthesis, gap auditing, dossier assembly, and wiki writeback. Conditional edges route from the gap auditor back to the planner for additional rounds or forward to the dossier assembler for completion.

The graph uses LangGraph.js checkpointing to persist state between rounds. The recursion limit is set to five to enforce the safety cap.

### 4.6 External Integrations

LLM API: The backend sends prompts to the user-configured LLM provider. All LLM calls are server-side. API keys are never exposed to the frontend.

Exa.ai: The backend sends search queries to the Exa.ai API. Deep search mode is used for primary research questions requiring multi-source synthesis. Instant search mode is used for quick verification checks. Highlights are used to minimize token consumption. Structured output schemas are used to return web evidence in the same shape as database query results. The contents API is used to extract clean markdown from known URLs.

## 5. Agentic Architecture

### 5.1 Pipeline A: Data Ingestion

Pipeline A transforms uploaded structured datasets into the LLM Wiki layer. It runs once per dataset.

The statistical profiler agent is an LLM call. It receives schema metadata and a sample of rows. It outputs a list of SQL profiling queries.

The SQL execution engine is non-LLM code. It runs the profiler's queries against the full SQLite dataset and returns aggregate results.

The wiki architect agent is an LLM call. It receives the SQL results. It outputs a draft wiki structure plan including index page content, proposed entity pages, and cross-KB linkage hints.

The human approval gate is a non-LLM UI pause. The backend exposes the draft plan via API. The frontend displays it. The user must explicitly approve or modify the plan via API before the pipeline continues.

The wiki writer agent is an LLM call. It receives the approved plan and the raw statistical results. It outputs final markdown pages stored in the wiki directory.

### 5.2 Pipeline B: Investigation

Pipeline B produces an investigation dossier from a free-text tip. It runs once per tip and may loop for up to five rounds.

The tip decomposer agent is an LLM call. It receives the raw tip and all knowledge base index pages. It outputs a research plan with three to five sub-claims.

The KB navigator agent is an LLM call. It receives each sub-claim and all index pages. It outputs a ranked list of relevant knowledge bases per sub-claim, with relevance scores and justifications.

The query generator agent is an LLM call. It receives each sub-claim and the schema of its assigned knowledge bases. It outputs either SQL queries for SQLite or Exa search parameters for web research.

The query executor is non-LLM code. It runs SQLite queries via the database driver or Exa queries via HTTP API.

The entity resolver agent is an LLM call. It receives result sets from multiple sources. It outputs connection findings with confidence scores, noting cross-source matches and contradictions.

The evidence synthesizer agent is an LLM call. It receives raw results, entity pages, and connection findings. It outputs narrative synthesis per sub-claim with confidence ratings.

The gap auditor agent is an LLM call. It receives the full synthesis and investigation state. It outputs a decision: CONTINUE, STOP_COMPLETE, or STOP_WITH_GAPS.

The loop controller is non-LLM routing logic. It implements the conditional edge in LangGraph.js based on the auditor's decision.

The dossier assembler agent is an LLM call. It receives the full synthesis and audit trail. It outputs the final structured markdown dossier.

The wiki writeback agent is an LLM call. It receives the dossier. It outputs new findings pages and updated index pages stored in the wiki directory.

### 5.3 Pipeline C: Gap Discovery Suggestions

Pipeline C is not a fully active pipeline in the MVP. When the gap auditor identifies unfillable gaps, the dossier assembler appends a suggestion block to the dossier. This block is generated by an LLM call that receives the gap characterization and suggests what types of data sources might fill the gap.

## 7. Non-Functional Requirements

### 7.1 Performance

The investigation pipeline must complete within a reasonable time for a live demo. Target: under three minutes for a five-round investigation with Exa queries. SQLite queries must execute in milliseconds. Exa deep search may take 12 to 40 seconds per call; the UI must show progress during these waits.

### 7.2 Error Handling

If any agent, API call, or database query fails during the investigation, the entire pipeline stops. The error is surfaced to the UI with a clear message indicating which stage failed and why. The user can retry the investigation from the failed stage. The system preserves the investigation state up to the failure point.

LLM API errors trigger exponential backoff retry. Exa API errors trigger retry with jitter. SQL syntax errors are caught before execution and surfaced to the query generator for correction if possible, or to the user if not.

### 7.3 Security

LLM API keys and Exa API keys are stored server-side only, in environment variables or a local configuration file. They are never sent to the frontend. The frontend sends requests to the backend, and the backend makes all external API calls.

The system is a personal prototype with no user authentication, no multi-tenancy, and no persistent user accounts. All data is local to the running instance.
