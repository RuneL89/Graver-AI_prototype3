# Knowledge Graph v2 — Bubble Layout & Source Interactivity

> **Status**: Awaiting approval  
> **Scope**: Graph layout redesign + click-through source exploration  
> **Branch target**: `feature/knowledge-graph-v2`

---

## 1. Problem Statement

The current knowledge graph uses a flat, columnar left-to-right layout that feels like a flowchart rather than an organic investigation map. Sources are deduplicated globally, making it hard to see which sub-claim each source supports. Nodes are not interactive — clicking does nothing, and there is no way to inspect the actual SQL query or Exa URL that produced a piece of evidence.

### What the user wants
- **Bubble layout**: user tip at the centre, sub-claims orbiting around it, sources orbiting around their parent sub-claims.
- **Click-to-highlight**: clicking any node dims unconnected nodes/edges and highlights the direct neighbourhood.
- **SQLite source click**: opens a 60 % viewport popup showing the **exact SQL query that was executed** and **its result set** (not just `SELECT * FROM table`).
- **Exa source click**: opens the source URL in a new browser tab.

---

## 2. Root Cause Analysis

| Gap | Why it exists |
|---|---|
| Graph has no query results | `Dossier` only stores *summarised* sources (`link`, `description`). The original `EvidenceBundle` (which contains `query` + `results`) is discarded after the investigation finishes. It is never persisted to SQLite. |
| Graph layout is columnar | `buildNodesAndEdges` places nodes on fixed X coordinates. No radial math is used. |
| Nodes are not clickable | React Flow is mounted in "uncontrolled" mode with no `onNodeClick` handler. Custom node components have no click events. |
| SQLite preview shows raw table | `SourceTableModal` fetches `/api/source/:tableName` which runs `SELECT * FROM table`. There is no endpoint to view the results of a *specific* historical query. |

---

## 3. Architecture Decisions

### AD-1: Persist `evidence` alongside `dossier`
- **Where**: new column `evidence_json TEXT` in the `investigations` table.
- **Why**: The frontend needs the original `EvidenceBundle[]` to display query text and result tables. The `Dossier` type is intentionally summarised; we will not bloat it with raw results.
- **Backward compat**: Old rows without `evidence_json` will return `[]`. Source nodes built from old investigations will show a "Query data unavailable" fallback.

### AD-2: Build source nodes directly from `evidence`, not from `dossier.sourceAttribution`
- **Why**: `sourceAttribution` is LLM-generated prose and may not reliably map back to individual `EvidenceBundle`s. `evidence` is the ground-truth record of what was executed.
- **Trade-off**: Some `sourceAttribution` entries that don't correspond to executed queries will not appear as source nodes. This is acceptable — the graph should show *actionable* sources.

### AD-3: Source nodes are per-sub-claim (not globally deduplicated)
- **Why**: In a bubble layout, a source orbiting sub-claim A should be visually distinct from the same table orbiting sub-claim B. The user explicitly asked for "sources surrounding" sub-claims.
- **Trade-off**: The same table may appear multiple times. This is correct for the visual model.

### AD-4: SQLite popup is frontend-only (no new API endpoint)
- **Why**: Because we will persist `evidence.results` in `evidence_json`, the frontend already has every row the query returned. No new `POST /api/query` endpoint is needed, avoiding SQL-injection risk.
- **Fallback**: If `evidence_json` is missing (old investigations), the popup shows the query text with a "Results not available" message.

### AD-5: Entity nodes remain on an outer ring
- **Why**: The user focused on tip → sub-claim → source relationships. Entities from `dossier.connections` are kept as a 4th outer ring but styled smaller to avoid visual clutter.

---

## 4. Files to Create / Modify

### New files
| File | Purpose |
|---|---|
| `frontend/src/components/SourceQueryModal.tsx` | 60 % viewport modal that renders a SQL code block + result table from an `EvidenceBundle` |

### Modified files
| File | What changes |
|---|---|
| `backend/src/db/migrate.ts` | Add `evidence_json TEXT` column to `investigations` |
| `backend/src/routes/investigate.ts` | Persist `evidence` on completion; return `evidence` in `GET /api/investigate/:id` and `GET /api/investigations/:id` |
| `shared/types.ts` | No changes required (reuses existing `EvidenceBundle` type) |
| `frontend/src/components/KnowledgeGraph.tsx` | Complete rewrite of layout engine (radial bubble); add click handlers; add selection state for highlight; circular node styling; attach `evidence` data to source nodes |
| `frontend/src/components/InvestigationGraphModal.tsx` | Accept optional `evidence` prop; pass it to `KnowledgeGraph`; manage `SourceQueryModal` open/close state |
| `frontend/src/components/DossierViewer.tsx` | Accept optional `evidence` prop; pass it to `InvestigationGraphModal` |
| `AGENTS.md` | Update sections 6.2 and 10 to mention `SourceQueryModal` and evidence persistence |

---

## 5. Implementation Phases

### Phase 1: Backend Evidence Persistence
**Goal**: Completed investigations store their raw evidence bundles.

1. **Migration** (`backend/src/db/migrate.ts`)
   ```sql
   ALTER TABLE investigations ADD COLUMN evidence_json TEXT;
   ```
2. **`runInvestigation` persistence** (`backend/src/routes/investigate.ts`)
   - Insert `evidence_json = JSON.stringify(typedFinalState.evidence ?? [])` alongside `dossier_json`.
3. **`GET /api/investigate/:id`**
   - Add `evidence: session.finalState?.evidence ?? []` to the JSON response.
4. **`GET /api/investigations/:id`**
   - Parse `evidence_json` and return `evidence: EvidenceBundle[]`.
5. **`GET /api/investigations`**
   - Unchanged (does not return evidence to keep list payload small).
6. **Verification**: Run an investigation; query SQLite and confirm `evidence_json` is non-empty valid JSON.

### Phase 2: Graph Layout & Interaction Redesign
**Goal**: Bubble layout with click-to-highlight.

1. **Radial layout algorithm** (`KnowledgeGraph.tsx`)
   - Tip: `(0, 0)`, styled as the largest circle.
   - Sub-claims: radius `300`, evenly distributed around the full circle.
   - Sources per sub-claim: radius `140` from the sub-claim centre, evenly distributed in a local arc.
   - Entities: radius `600`, evenly distributed.
2. **Node styling**
   - All nodes become circular (`rounded-full` or explicit `border-radius: 50%`).
   - Tip: `bg-slate-800 text-white`, diameter ~160 px.
   - Sub-claim: confidence-coloured border, diameter ~120 px.
   - Source: `bg-white border-slate-300`, diameter ~80 px.
   - Entity: confidence-coloured border, diameter ~80 px.
3. **Selection / highlight state**
   - `selectedNodeId` state.
   - `onNodeClick` → set selected node.
   - Compute `connectedNodeIds` and `connectedEdgeIds` by walking adjacency.
   - Unselected nodes/edges get `opacity: 0.25`.
   - Click background / press Escape → deselect.
4. **Edge styling**
   - Tip→subClaim: `stroke-slate-400 stroke-2`
   - subClaim→source: `stroke-slate-300 stroke-1`
   - entity→source: `stroke-slate-400 stroke-1`

### Phase 3: Source Click Behaviours
**Goal**: SQLite popup + Exa new-tab.

1. **`SourceQueryModal.tsx`** (new component)
   - Props: `query: string; results: unknown[]; onClose: () => void`
   - Backdrop + centred container `w-[60vw] h-[60vh]`.
   - Header shows "SQLite Query Results".
   - SQL displayed in a `<pre>` block with `bg-slate-900 text-green-400` syntax-like styling.
   - Results displayed in a table: columns derived from `Object.keys(results[0])`, rows mapped from the objects.
   - Handles empty results gracefully.
2. **`KnowledgeGraph.tsx` source click wiring**
   - For a source node whose `sourceType === "sqlite"`:
     - `onNodeClick` → call `onSqliteSourceClick(bundle)` prop (passes the full `EvidenceBundle`).
   - For a source node whose `sourceType === "exa"`:
     - `onNodeClick` → extract first URL from `bundle.results` and `window.open(url, "_blank")`.
3. **`InvestigationGraphModal.tsx`**
   - Add `sourceQueryModal` state (`{ open: boolean; query: string; results: unknown[] } | null`).
   - Pass `onSqliteSourceClick` to `KnowledgeGraph`.
   - Conditionally render `<SourceQueryModal />`.
4. **`DossierViewer.tsx`**
   - Accept optional `evidence?: EvidenceBundle[]`.
   - Pass it through to `InvestigationGraphModal`.

### Phase 4: Live Investigation Wiring
**Goal**: The "View Knowledge Graph" button inside `DossierViewer` (live investigation) also works with the new interactivity.

1. **`InvestigatePage.tsx`** or wherever `DossierViewer` is rendered — pass `evidence` from the in-memory session state.
2. If the session fetch endpoint (`GET /api/investigate/:id`) now returns `evidence`, the frontend polling loop can capture it.

### Phase 5: Integration & Polish
**Goal**: Everything compiles, looks consistent, and old investigations degrade gracefully.

1. **Styling pass**
   - Node colours match existing confidence badges exactly.
   - Modal backdrop matches `SourceTableModal` aesthetic.
   - Responsive: modal becomes `w-[95vw] h-[90vh]` on mobile.
2. **Graceful degradation**
   - If `evidence` is undefined/empty, source nodes still render but clicking a SQLite source shows "Query results not available for this investigation." instead of a table.
3. **Type-check & build**
   - `npm run typecheck` all workspaces.
   - `npm run build` all workspaces.
4. **Update `AGENTS.md`**
   - Section 5: mention `evidence_json` persistence.
   - Section 6.2: add `SourceQueryModal`.
   - Section 10: add evidence persistence step.

---

## 6. Data Flow

```
User submits tip
    ↓
Investigation runs → graph state accumulates evidence[]
    ↓
Graph completes → runInvestigation() inserts:
    investigations (id, tip, status, dossier_json, evidence_json, ...)
    ↓
User opens Wiki findings page → clicks "View Knowledge Graph"
    ↓
GET /api/investigations/:id → returns { dossier, evidence, ... }
    ↓
InvestigationGraphModal renders KnowledgeGraph(dossier, evidence)
    ↓
KnowledgeGraph builds radial nodes:
    tip (centre) → subclaims (orbit) → sources (local orbit per subclaim)
    ↓
User clicks a SQLite source node
    ↓
SourceQueryModal opens with evidence.query + evidence.results
    ↓
User clicks an Exa source node
    ↓
window.open(evidence.results[0].url, "_blank")
```

---

## 7. Technical Acceptance Criteria

### Backend
- [ ] SQLite `investigations` table has `evidence_json TEXT` column.
- [ ] `npm run migrate -w backend` is idempotent.
- [ ] A completed investigation inserts non-empty JSON into `evidence_json`.
- [ ] `GET /api/investigate/:id` includes `evidence: EvidenceBundle[]` in the response.
- [ ] `GET /api/investigations/:id` includes `evidence: EvidenceBundle[]` parsed from `evidence_json`.
- [ ] `GET /api/investigations/:id` returns `evidence: []` for rows created before this migration (backward compatibility).
- [ ] Failed / cancelled investigations do **not** insert rows (unchanged from v1).

### Frontend — Graph
- [ ] `KnowledgeGraph.tsx` renders nodes in a radial layout (tip centre, sub-claims inner ring, sources local orbit, entities outer ring).
- [ ] Nodes are visually circular (not rectangular).
- [ ] Node sizes vary by type (tip largest, sub-claims medium, sources/entities smallest).
- [ ] Clicking a node highlights all directly connected nodes and edges; unconnected elements are dimmed.
- [ ] Clicking the canvas background or pressing Escape clears the selection.
- [ ] `npm run typecheck` passes.

### Frontend — Source Interactivity
- [ ] `SourceQueryModal.tsx` exists and renders at 60 vw / 60 vh on desktop, 95 vw / 90 vh on mobile.
- [ ] Clicking a SQLite source node opens `SourceQueryModal` pre-populated with the query string and result table.
- [ ] The SQL query is displayed in a styled code block.
- [ ] The result table shows all columns and rows from `evidence.results`.
- [ ] Clicking an Exa source node opens the URL in a new browser tab.
- [ ] If `evidence` is missing for a source, the SQLite popup shows a "Query results not available" message instead of crashing.

### Integration
- [ ] Wiki-page graph button (`InvestigationGraphModal` with `investigationId`) fetches evidence and renders interactive graph.
- [ ] Dossier-viewer graph button (`DossierViewer` → `InvestigationGraphModal` with direct props) passes evidence through and renders interactive graph.
- [ ] `AGENTS.md` is updated.
- [ ] `npm run build` succeeds for all workspaces.

---

## 8. End-User Acceptance Criteria (UAT)

- [ ] I can submit a tip, wait for completion, open the knowledge graph from the wiki, and see my tip as a large central bubble.
- [ ] Sub-claims appear as coloured bubbles orbiting the tip.
- [ ] SQLite sources appear as smaller white bubbles orbiting their parent sub-claim.
- [ ] Entities appear on an outer ring.
- [ ] Clicking any node dims everything except that node and its directly connected neighbours.
- [ ] Clicking a SQLite source bubble opens a popup that shows the exact SQL query the agent ran.
- [ ] The same popup shows a table with the rows that query returned.
- [ ] Clicking an Exa source bubble opens the source website in a new browser tab.
- [ ] I can close the SQLite popup and return to the graph.
- [ ] The graph looks good on both desktop and mobile (responsive modal sizing).
- [ ] I can open the graph directly from the live investigation dossier viewer and get the same interactive behaviour.
- [ ] I am satisfied the feature is ready for demonstration.

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `evidence_json` becomes very large (>1 MB) for investigations with huge SQL result sets | Medium | Medium | SQLite TEXT limit is 1 GB. Typical investigations return dozens/hundreds of rows. If size becomes an issue later, cap result storage (e.g. first 50 rows per bundle). |
| Old investigations (pre-v2) have no `evidence_json` → source clicks show "unavailable" | High | Low | Acceptable degradation. Old graphs still render; clicks just show a friendly fallback message. |
| Radial layout overlaps nodes when there are many sources (>20) | Medium | Medium | Dynamic radius scaling: increase orbit radius based on node count. Cap displayed sources per sub-claim at 15 with a "+N more" indicator. |
| React Flow click handlers conflict with pan/zoom | Low | Medium | Use `onNodeClick` (not `onClick` on the div) which React Flow handles correctly alongside canvas interactions. |

---

## 10. Out of Scope

- Server-side graph layout pre-computation.
- Persisting node positions after user drag (React Flow handles this in memory only).
- Exporting graph as PNG/SVG.
- Filtering/hiding node types.
- Editing the graph (adding/removing nodes).
- Re-running SQL queries from the popup (popup is read-only historical view).
