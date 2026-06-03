# Sprint 5: Investigation Pipeline Completion (Pipeline B — Part 2)

## STEP 0: Read the FRD

Before writing any code, read the relevant sections of the Functional Requirements Document:

- **FRD Section 3.3** — Core Feature: Investigation (entity resolution through wiki writeback)
- **FRD Section 3.6** — Core Feature: Gap Discovery Suggestions
- **FRD Section 5.2** — Pipeline B: Investigation (Entity Resolver through Wiki Writeback)
- **FRD Section 4.5** — Agent Orchestration (conditional edges, checkpointing, recursion limit)
- **FRD Section 7.1** — Performance (under 3 minutes target)

Refer to [FRD_Graver_AI_Prototype.md](../../FRD_Graver_AI_Prototype.md) for full requirement context.

## Goal

The second half of Pipeline B is functional: entity resolution → evidence synthesis → gap auditing → loop control → dossier assembly → wiki writeback. The full investigation loop runs end-to-end, produces a dossier, and handles the 5-round safety cap.

## Implementation Tasks

1. **Implement Entity Resolver skill** (`backend/src/skills/entityResolverSkill.ts`)
   - **FRD Reference: Section 5.2 — Entity Resolver Agent**
   - Input: result sets from multiple KBs (SQLite + Exa)
   - LLM prompt: "Find shared identifiers across these result sets: CVR numbers, names, dates, locations. Flag potential matches, aliases, and cross-references. Note when Exa results confirm or contradict local database results."
   - Output: `ConnectionFindings` with `connections[]`, `contradictions[]`, `confidenceScores`
   - Writes connection findings to wiki
   - Follows the `AgentSkill` interface

2. **Implement Evidence Synthesizer skill** (`backend/src/skills/evidenceSynthesizerSkill.ts`)
   - **FRD Reference: Section 5.2 — Evidence Synthesizer Agent**
   - Input: raw results + entity pages + connection findings
   - LLM prompt: "Assemble evidence into narrative summaries per sub-claim. Assign confidence: HIGH (direct evidence, multiple sources), MEDIUM (inferred), LOW (single source, circumstantial). Flag contradictions."
   - Output: `Synthesis` with `entries[]` (one per sub-claim)
   - Follows the `AgentSkill` interface

3. **Implement Gap Auditor skill** (`backend/src/skills/gapAuditorSkill.ts`)
   - **FRD Reference: Section 5.2 — Gap Auditor Agent**
   - Input: full synthesis + investigation state + round history
   - LLM prompt: "Evaluate: novelty (new entities/connections this round?), coverage (all sub-claims have evidence?), opportunity (unqueried KBs that might help?). Return decision: CONTINUE, STOP_COMPLETE, or STOP_WITH_GAPS."
   - Output: `AuditDecision` with `decision`, `reasoning`, `suggestedQueries[]` (if CONTINUE)
   - Follows the `AgentSkill` interface

4. **Implement Loop Controller** (`backend/src/agents/loopController.ts`)
   - **FRD Reference: Section 5.2 — Loop Controller (non-LLM)**
   - LangGraph conditional edge
   - If auditor says CONTINUE and round < 5: route back to KB Navigator with cumulative context
   - If auditor says STOP_COMPLETE or STOP_WITH_GAPS: route to Dossier Assembler
   - If round == 5: force route to Dossier Assembler regardless of auditor
   - Increment round counter

5. **Implement Dossier Assembler skill** (`backend/src/skills/dossierAssemblerSkill.ts`)
   - **FRD Reference: Section 3.3 — Dossier Content**
   - Input: full synthesis + audit trail + all evidence bundles + investigation state
   - LLM prompt: "Format a structured investigation dossier with: Executive Summary, Findings by Sub-Claim, Cross-Source Connections, Evidence Gaps, Confidence Summary, Source Attribution, Suggested Next Steps."
   - Output: `Dossier` object with markdown content and structured sections
   - Follows the `AgentSkill` interface

6. **Implement Gap Discovery Suggestions** (`backend/src/skills/gapDiscoverySkill.ts`)
   - **FRD Reference: Section 3.6 — Gap Discovery Suggestions**
   - Input: gap characterization from auditor
   - LLM prompt: "Suggest what data is missing, what type of knowledge base would contain it, and what public sources might exist."
   - Output: `GapSuggestions` appended to dossier
   - Follows the `AgentSkill` interface

7. **Implement Wiki Writeback skill** (`backend/src/skills/wikiWritebackSkill.ts`)
   - **FRD Reference: Section 5.2 — Wiki Writeback Agent**
   - Input: dossier
   - Creates `findings/{investigation-id}.md` in the global findings directory
   - Updates relevant KB index pages to note new cross-KB connections
   - Maintains bidirectional wikilinks
   - Follows the `AgentSkill` interface

8. **Complete investigation graph** (`backend/src/agents/investigationGraph.ts`)
   - Add nodes: Entity Resolver → Synthesizer → Gap Auditor → Dossier Assembler → Wiki Writeback
   - Connect conditional edge from Auditor to either loop back or proceed
   - Ensure checkpointing persists state across rounds
   - Ensure SSE events cover all new stages

9. **Implement Dossier Viewer** (`frontend/src/components/DossierViewer.tsx`)
   - **FRD Reference: Section 3.3 — Dossier Rendering**
   - Renders markdown dossier with collapsible sections
   - Executive Summary always expanded
   - Findings, Connections, Gaps, Attribution as collapsible sections
   - Confidence ratings displayed with color coding (HIGH = green, MEDIUM = yellow, LOW = red)
   - Source attribution as clickable links or query references

10. **Implement Wiki Viewer** (`frontend/src/components/WikiViewer.tsx`)
    - Browse wiki pages by knowledge base
    - Render markdown with wikilink navigation
    - Click wikilinks to navigate between pages
    - Display page metadata (last modified, source KB)

## Technical Acceptance Criteria (Kimi Code checks)

- [ ] Entity Resolver finds connections across SQLite and Exa results
- [ ] Evidence Synthesizer produces narrative summaries with confidence ratings
- [ ] Gap Auditor correctly identifies when to continue, stop complete, or stop with gaps
- [ ] Loop Controller routes correctly: continues up to 5 rounds, stops at cap
- [ ] Dossier Assembler produces all required sections (Executive Summary, Findings, Connections, Gaps, Confidence, Attribution, Next Steps)
- [ ] Gap Discovery Suggestions are appended when gaps exist
- [ ] Wiki Writeback creates findings pages and updates indexes
- [ ] Full investigation graph runs end-to-end from tip to dossier
- [ ] Dossier Viewer renders all sections with collapsible UI
- [ ] Wiki Viewer displays pages and navigates wikilinks
- [ ] `npx tsc --noEmit` passes

## End-User Acceptance Criteria (User verifies)

- [ ] I can submit a tip and the full investigation runs automatically
- [ ] I can see the agent stream through all stages: decomposition, navigation, queries, resolution, synthesis, auditing, assembly
- [ ] I can see the investigation loop through multiple rounds when the auditor decides to continue
- [ ] I can see the final dossier with all sections
- [ ] I can expand/collapse sections in the dossier
- [ ] I can see confidence ratings color-coded
- [ ] I can see source attribution for every claim
- [ ] I can see gap suggestions when evidence is missing
- [ ] I can browse the wiki and see new findings pages from the investigation
- [ ] The investigation stops within 5 rounds

## Sprint Completion Rules

### Do Not Proceed Without UAT Acceptance
You **must not** begin Sprint 6 until **all** Technical Acceptance Criteria and **all** End-User Acceptance Criteria above are checked off. The user must explicitly confirm UAT acceptance.

### Push to Main on UAT Acceptance
Once the user confirms that the UAT Criteria are accepted, push this sprint to the Main branch.

### Update README.md
After completing this sprint and before pushing to Main, update the [README.md](../../README.md) Sprint Status table to mark Sprint 5 as **Complete** and reflect the current project state.
