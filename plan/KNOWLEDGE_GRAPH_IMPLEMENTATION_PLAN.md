# Knowledge Graph Visualization — Implementation Plan

> **Status**: Ready for implementation  
> **Feature**: Interactive knowledge graph for investigation dossiers  
> **Scope**: Backend persistence + frontend visualization + wiki integration  

---

## 1. Vision & Problem Statement

### What it solves
Currently, Graver-AI produces a structured investigation dossier (sub-claims, evidence, sources, connections) as text. Journalists must read through prose to understand how claims interconnect and which sources support which claims. For complex investigations with multiple rounds of evidence gathering, this becomes cognitively demanding.

A knowledge graph solves this by:
- **Visualizing relationships** between the user's tip, decomposed sub-claims, discovered entities, and sources (SQLite wiki + Exa web search).
- **Surfacing confidence at a glance** via color-coded nodes (HIGH / MEDIUM / LOW).
- **Enabling historical review** by persisting investigations so journalists can reopen past cases and see their graph.
- **Bridging wiki and investigation** by embedding a link in wiki dossier pages that opens the graph in-context.

### Vision
The journalist submits a tip. After the investigation completes, they see — in addition to the text dossier — an interactive bubble graph with their tip at the center, sub-claims orbiting around it, sources fanning out, and cross-source entity connections drawn as edges. When they later browse the wiki and open a past investigation dossier, a button opens the same graph in an 80% viewport modal.

---

## 2. Requirements

### Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | Investigations that reach completion must be persisted to SQLite so they can be retrieved later. |
| FR-2 | A new API endpoint must allow listing all persisted investigations. |
| FR-3 | A new API endpoint must allow fetching a single persisted investigation by ID. |
| FR-4 | The `wikiWritebackSkill` must include the investigation ID in the wiki markdown it generates, using YAML frontmatter. |
| FR-5 | The wiki viewer (`WikiPage.tsx`) must parse frontmatter from loaded pages. If an `investigation_id` field is present, it must render a "View Knowledge Graph" button above the markdown content. |
| FR-6 | Clicking the "View Knowledge Graph" button must open an 80% viewport modal containing an interactive React Flow canvas. |
| FR-7 | The knowledge graph must display the following node types: **Tip** (center), **Sub-Claim**, **Source**, **Entity** (from cross-source connections). |
| FR-8 | The knowledge graph must display edges showing: tip→sub-claim, sub-claim→source, entity→source, and sub-claim→entity where derivable. |
| FR-9 | Nodes must be color-coded by the existing confidence rating (HIGH = green, MEDIUM = amber, LOW = red). |
| FR-10 | Node positions must be computed client-side (React Flow auto-layout). No server-side layout logic. |
| FR-11 | The graph must be interactive: pan, zoom, and hoverable tooltips showing node details. |
| FR-12 | The graph data must be derived entirely from the existing `Dossier` type. No new backend graph-generation logic. |

### Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | The implementation must not break existing investigation flows (SSE streaming, in-session Map storage). |
| NFR-2 | The implementation must follow existing TypeScript strict mode conventions and `.js` import extensions. |
| NFR-3 | The implementation must use Tailwind CSS for all styling, matching the existing UI aesthetic. |
| NFR-4 | The implementation must not introduce SQL injection risks; investigation persistence must use parameterized inserts. |
| NFR-5 | The implementation must handle the case where `reactflow` is not yet installed (add it to `frontend/package.json`). |
| NFR-6 | The implementation must gracefully handle missing or malformed frontmatter in wiki pages. |

---

## 3. Architecture & Design Decisions

### 3.1 Persistence Strategy
- **Where**: SQLite table `investigations`.
- **Why not wiki files**: The wiki is a prose-oriented markdown store. Investigation results are structured JSON. SQLite provides queryability, referential integrity, and a natural list endpoint.
- **What is stored**: `id`, `tip`, `status`, `dossier_json` (TEXT), `created_at`, `completed_at`.
- **What is NOT stored**: Graph layout, node positions, or React Flow state. The graph is a pure view of the dossier.
- **Scope of persistence**: Only investigations that reach `complete` status are persisted. Running, failed, or cancelled investigations remain in the in-memory Map only. This keeps the database clean and avoids storing incomplete data.

### 3.2 Wiki Integration Strategy
- **Frontmatter format**: YAML wrapped in `---` at the top of the markdown file.
- **Fields**: `investigation_id` (required), optionally `tip` for human context.
- **Rendering**: `WikiPage.tsx` must strip frontmatter before passing content to `react-markdown`. Frontmatter parsing should be lightweight (regex-based or `gray-matter`) and failure-tolerant.
- **UI placement**: A subtle banner or button row above the `<article>` prose container, only rendered when `investigation_id` is present.

### 3.3 Graph Data Flow
- **Source of truth**: The `Dossier` object (already defined in `shared/types.ts`).
- **Transformation layer**: A frontend utility function that accepts a `Dossier` and returns React Flow `Node[]` and `Edge[]` arrays.
- **Node types**:
  - `tip`: The original user tip (1 node, always center).
  - `subClaim`: From `dossier.findings[].claimText` (or `subClaimId` if `claimText` is missing).
  - `source`: From `dossier.sourceAttribution[]` and `dossier.findings[].sources[]`.
  - `entity`: From `dossier.connections[].entityIdentifier`.
- **Edge types**:
  - `tip→subClaim`: One edge per finding.
  - `subClaim→source`: From `findings[].sources[]` and `sourceAttribution[]`.
  - `entity→source`: From `connections[].sources[]`.
  - `subClaim→entity`: Inferred when an entity's source list overlaps with a sub-claim's source list (optional, can be omitted for simplicity in v1).
- **Confidence mapping**: Node background colors map to the existing `confidence` field on `Synthesis` and `ConnectionFinding`.

### 3.4 Component Architecture
- **New component**: `InvestigationGraphModal.tsx` — wraps React Flow in a modal shell (80vw / 80vh), handles fetch, loading, and error states.
- **New component**: `KnowledgeGraph.tsx` — pure presentation component. Takes `dossier: Dossier` as prop. Builds nodes/edges internally. Uses React Flow's `Background`, `Controls`, and a layout hook.
- **Modified component**: `WikiPage.tsx` — adds frontmatter parsing and conditional "View Knowledge Graph" button.
- **Modified component**: `DossierViewer.tsx` — optionally adds a "View Knowledge Graph" button when displaying a completed dossier (nice-to-have, not strictly required).

---

## 4. Implementation Order

The implementation is divided into 5 sequential phases. Each phase builds on the previous and can be verified independently.

### Phase 1: Backend Persistence Layer
**Goal**: Investigations are saved to SQLite upon completion.

1. **Migration**: Add `backend/src/db/migrate.ts` entry to create the `investigations` table with columns: `id TEXT PRIMARY KEY`, `tip TEXT NOT NULL`, `status TEXT NOT NULL`, `dossier_json TEXT`, `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, `completed_at DATETIME`.
2. **Route updates in `backend/src/routes/investigate.ts`**:
   - Import the database connection.
   - At the end of `runInvestigation`, when `status === "complete"`, insert a row into `investigations` with `dossier_json = JSON.stringify(typedFinalState.dossier)`.
   - Ensure the insert is wrapped in a try/catch so a DB failure does not fail the investigation itself.
3. **New endpoints in `backend/src/routes/investigate.ts`** (or a new file if preferred):
   - `GET /api/investigations` — returns a list of persisted investigations (`id`, `tip`, `status`, `created_at`, `completed_at`), ordered by `created_at DESC`.
   - `GET /api/investigations/:id` — returns the full investigation row including `dossier_json` parsed back into an object.
4. **Verification**: Run an investigation via the UI. Check that a row appears in SQLite with valid JSON.

### Phase 2: Wiki Writeback Frontmatter
**Goal**: Completed investigations write their ID into the wiki markdown.

1. **Modify `backend/src/skills/wikiWritebackSkill.ts`**:
   - The skill currently receives the final `InvestigationState` and writes markdown pages.
   - Update the markdown generation for the top-level index/dossier page to prepend YAML frontmatter:
     ```markdown
     ---
     investigation_id: <state.id>
     tip: "<state.tip>"
     ---
     
     ```
   - Ensure the `tip` value is sanitized (escaped quotes) to avoid breaking YAML.
2. **Verification**: Run an investigation to completion. Open the generated wiki file and confirm frontmatter is present at the top.

### Phase 3: Wiki Frontmatter Parsing & Button
**Goal**: The wiki viewer detects investigation pages and offers a graph button.

1. **Modify `frontend/src/pages/WikiPage.tsx`**:
   - Add a helper function `parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string }`.
   - The parser should be tolerant: if no frontmatter is found, return empty frontmatter and the original body.
   - In `loadPage`, after receiving `data.content`, call `parseFrontmatter` and store `frontmatter` and `body` in separate state variables.
   - Pass `body` (not `content`) to `react-markdown`.
   - Conditionally render a banner/button above the `<article>` when `frontmatter.investigation_id` exists.
   - The button should open a modal. For now, the modal can be a placeholder div.
2. **Verification**: Load a wiki page with frontmatter. Confirm the button appears and the markdown renders without showing the frontmatter. Load a page without frontmatter and confirm no button appears.

### Phase 4: Knowledge Graph Components
**Goal**: Build the interactive graph UI.

1. **Install dependency**: Add `reactflow` to `frontend/package.json` and run `npm install`.
2. **Create `frontend/src/components/KnowledgeGraph.tsx`**:
   - Props: `dossier: Dossier`.
   - Internal function `buildNodesAndEdges(dossier)`:
     - Create a `tip` node at a fixed center position.
     - Create `subClaim` nodes from `dossier.findings`, positioned in a radial layout or using React Flow's auto-layout.
     - Create `source` nodes from `dossier.sourceAttribution` and `findings[].sources`, deduplicated by source detail or URL.
     - Create `entity` nodes from `dossier.connections`.
     - Create edges between tip→subClaims, subClaims→sources, entities→sources.
     - Map confidence to Tailwind color classes for node backgrounds.
   - Render using `<ReactFlow>`, `<Background>`, `<Controls>`, and custom node components for each type.
   - Add hover tooltips showing node metadata (e.g., entity notes, source detail).
3. **Create `frontend/src/components/InvestigationGraphModal.tsx`**:
   - Props: `investigationId: string; onClose: () => void`.
   - Fetches `/api/investigations/${investigationId}` on mount.
   - While loading, shows a spinner.
   - On success, renders `<KnowledgeGraph dossier={data.dossier} />`.
   - On error, shows an error message.
   - Modal styling: fixed overlay, centered container `w-[80vw] h-[80vh]`, white background, rounded corners, shadow, close button.
4. **Wire up `WikiPage.tsx`**:
   - Replace the placeholder modal from Phase 3 with `<InvestigationGraphModal investigationId={frontmatter.investigation_id} onClose={...} />`.
5. **Verification**: Open a wiki page with frontmatter. Click the button. Confirm the modal opens, fetches data, and renders nodes and edges.

### Phase 5: Integration, Polish & Documentation
**Goal**: Feature is complete, documented, and consistent.

1. **Add graph button to `DossierViewer.tsx`** (optional but recommended):
   - When a dossier is displayed after a live investigation, add a "View Knowledge Graph" button that opens the same modal without requiring a wiki page.
   - This uses the in-memory dossier directly, bypassing the `/api/investigations/:id` fetch.
2. **Styling pass**:
   - Ensure node colors match the existing confidence badge colors used in `DossierViewer.tsx`.
   - Ensure the modal backdrop and container match the existing `SourceTableModal` aesthetic.
   - Add responsive behavior: on small screens, modal should become `w-[95vw] h-[90vh]`.
3. **Update `AGENTS.md`**:
   - Section 5: Change "Investigations run in-memory only" to reflect that completed investigations are persisted to SQLite.
   - Section 6.1: Add `investigations` table to the backend modules list.
   - Section 6.2: Add `KnowledgeGraph` and `InvestigationGraphModal` to the frontend modules list.
   - Section 10 (Data Flow): Add the persistence step to Pipeline B.
4. **Update `shared/types.ts` if needed**:
   - If frontend-only types for graph nodes/edges are needed, they can be defined in the frontend. Do not add React Flow types to `shared/types.ts` to avoid coupling the backend to a frontend library.
5. **Final verification**:
   - End-to-end test: Submit tip → wait for completion → check SQLite row exists → check wiki file has frontmatter → open wiki page → click button → graph renders correctly.

---

## 5. Data Flow Diagram (Textual)

```
User submits tip
    ↓
POST /api/investigate
    ↓
Investigation runs in-memory (existing SSE stream)
    ↓
Graph completes → runInvestigation() inserts row into SQLite investigations table
    ↓
wikiWritebackSkill writes dossier to ./wiki/<kbName>/ with frontmatter
    ↓
User browses to Wiki page
    ↓
GET /api/wiki/<kb>/<page> returns markdown with frontmatter
    ↓
WikiPage.tsx parses frontmatter → renders "View Knowledge Graph" button
    ↓
User clicks button
    ↓
InvestigationGraphModal mounts → GET /api/investigations/:id
    ↓
KnowledgeGraph.tsx builds nodes/edges from Dossier JSON
    ↓
React Flow renders interactive canvas
```

---

## 6. Files to Create / Modify

### New Files
- `frontend/src/components/KnowledgeGraph.tsx`
- `frontend/src/components/InvestigationGraphModal.tsx`

### Modified Files
- `backend/src/db/migrate.ts` — add `investigations` table migration
- `backend/src/routes/investigate.ts` — add persistence, list, and fetch endpoints
- `backend/src/skills/wikiWritebackSkill.ts` — add frontmatter generation
- `frontend/src/pages/WikiPage.tsx` — add frontmatter parsing and modal trigger
- `frontend/package.json` — add `reactflow` dependency
- `AGENTS.md` — update architecture documentation

### No-Touch Files (Dependencies, but unchanged)
- `shared/types.ts` — `Dossier` type already sufficient
- `backend/src/wiki/store.ts` — raw read/write, frontmatter is just text
- `backend/src/agents/investigationGraph.ts` — no graph logic changes needed
- `frontend/src/components/DossierViewer.tsx` — optional button only

---

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Frontmatter breaks existing wiki pages that happen to start with `---` | Low | Medium | Parser must be strict: only treat the first block as frontmatter if it starts at line 0 and ends with a closing `---` on its own line. |
| React Flow bundle size is large | Medium | Low | Acceptable for a prototype. If size becomes an issue later, swap for a lighter library. |
| Large dossiers produce too many nodes/edges | Medium | Medium | Cap the number of source nodes displayed (e.g., top 20 by confidence). Add a "show all" toggle. |
| Database insert fails after investigation succeeds | Low | High | Wrap insert in try/catch and log error. Do not fail the investigation because of persistence. |
| `dossier_json` column grows large | Low | Low | SQLite TEXT has a 1GB limit. Typical dossiers are kilobytes. Monitor if needed. |

---

## 8. Acceptance Criteria

### Technical Acceptance Criteria (Kimi Code checks)

- [ ] SQLite `investigations` table exists with correct schema (`id`, `tip`, `status`, `dossier_json`, `created_at`, `completed_at`).
- [ ] `npm run migrate -w backend` runs successfully and is idempotent.
- [ ] A completed investigation inserts a row into `investigations` with valid JSON in `dossier_json`.
- [ ] A failed or cancelled investigation does **not** insert a row into `investigations`.
- [ ] `GET /api/investigations` returns a JSON array of completed investigations, ordered by `created_at DESC`.
- [ ] `GET /api/investigations/:id` returns the investigation row with `dossier` parsed from `dossier_json`.
- [ ] `GET /api/investigations/:id` returns 404 for non-existent IDs.
- [ ] `wikiWritebackSkill` prepends valid YAML frontmatter (`investigation_id`, `tip`) to the dossier markdown page.
- [ ] The frontmatter `tip` value is sanitized to avoid YAML parsing errors (quotes escaped).
- [ ] `WikiPage.tsx` strips frontmatter before passing body to `react-markdown`.
- [ ] `WikiPage.tsx` renders the "View Knowledge Graph" button only when `investigation_id` is present in frontmatter.
- [ ] Pages without frontmatter render normally with no button.
- [ ] `reactflow` is added to `frontend/package.json` and installs without conflicts.
- [ ] `KnowledgeGraph.tsx` renders a `ReactFlow` canvas with `Background` and `Controls`.
- [ ] `KnowledgeGraph.tsx` builds nodes for tip, sub-claims, sources, and entities from a `Dossier` prop.
- [ ] `KnowledgeGraph.tsx` builds edges for tip→sub-claim, sub-claim→source, and entity→source relationships.
- [ ] Nodes are color-coded by confidence: HIGH = green, MEDIUM = amber/amber-500, LOW = red.
- [ ] `InvestigationGraphModal.tsx` fetches `/api/investigations/:id` on mount and handles loading/error states.
- [ ] The modal renders at 80% viewport size on desktop and 95%/90% on mobile.
- [ ] The modal closes via a close button and clicking the backdrop.
- [ ] `AGENTS.md` is updated to reflect that completed investigations are persisted to SQLite.
- [ ] `npm run typecheck` passes for all workspaces (root, backend, frontend, shared).
- [ ] Existing investigation flows (start, stream, cancel, retry) continue to work unchanged.

### End-User Acceptance Criteria (User verifies)

- [ ] I can submit an investigation tip and wait for it to complete.
- [ ] After completion, I can query the SQLite database and see a row in the `investigations` table with my tip and a non-empty `dossier_json`.
- [ ] I can browse to the wiki page created by the investigation and see a "View Knowledge Graph" button at the top.
- [ ] I can click the button and an 80% screen modal opens with an interactive graph.
- [ ] I can see my original tip as a central node in the graph.
- [ ] I can see sub-claim nodes connected to the tip.
- [ ] I can see source nodes (wiki and Exa) connected to the sub-claims.
- [ ] I can see entity nodes from cross-source connections.
- [ ] I can pan and zoom the graph using the mouse.
- [ ] Node colors correspond to confidence ratings (green for HIGH, amber for MEDIUM, red for LOW).
- [ ] Hovering over a node shows additional details (e.g., entity notes, source description).
- [ ] I can close the modal and return to the wiki page.
- [ ] I can open a non-investigation wiki page and confirm no "View Knowledge Graph" button appears.
- [ ] I am satisfied the feature is ready for demonstration.

### Completion Rules

**Do not mark this feature complete until all Technical Acceptance Criteria and all End-User Acceptance Criteria are checked off.**

The user must explicitly confirm UAT acceptance before the feature is considered done.

---

## 9. Future Enhancements (Out of Scope)

The following are intentionally excluded from this plan to keep scope minimal:
- Persisting **all** investigations (including failed/running) rather than only completed ones.
- Server-side graph layout pre-computation.
- Exporting the graph as an image (PNG/SVG).
- Editable graphs (dragging nodes persists layout).
- Filtering/hiding node types in the UI.
- A dedicated "Investigation History" list page outside the wiki.
