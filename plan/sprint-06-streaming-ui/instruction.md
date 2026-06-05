# Sprint 6: Real-Time Streaming & UI Panels

## STEP 0: Read the FRD

Before writing any code, read the relevant sections of the Functional Requirements Document:

- **FRD Section 3.4** — Core Feature: Real-Time Agent Monitoring (SSE requirements, heartbeat, event types)
- **FRD Section 4.3** — Frontend architecture and panel descriptions
- **FRD Section 7.1** — Performance (smooth UI, no freezing)
- **FRD Section 7.2** — Error Handling (retry from failed stage, error surfacing)

Refer to [FRD_Graver_AI_Prototype.md](../FRD_Graver_AI_Prototype.md) for full requirement context.

## Goal

The UI is polished, real-time streaming is robust, and all panels are functional and visually coherent.

## Implementation Tasks

1. **Enhance SSE streaming** (`backend/src/routes/investigate.ts`)
   - **FRD Reference: Section 3.4 — Real-Time Agent Monitoring**
   - Ensure SSE connection stays alive during long-running operations
   - Heartbeat events every 15 seconds to prevent timeout
   - Proper cleanup on client disconnect
   - Event types: `stage_start`, `reasoning_chunk`, `stage_complete`, `query_executed`, `error`, `complete`

2. **Enhance Agent Stream component** (`frontend/src/components/AgentStream.tsx`)
   - Display active agent name with status indicator (running, completed, error)
   - Display selected knowledge bases per sub-claim
   - Display when Exa is queried vs. SQLite
   - Display query parameters (sanitized — no API keys)
   - Auto-scroll to latest event
   - Pause/resume scroll on user interaction

3. **Implement stage progress visualization** (`frontend/src/components/StageProgress.tsx`)
   - Visual pipeline diagram showing all stages
   - Completed stages in green, active in blue, pending in gray
   - Round counter display ("Round 2 of 5")
   - Click completed stages to expand their outputs

4. **Polish ingestion panel** (`frontend/src/components/IngestionPanel.tsx`)
   - Better file drop zone with visual feedback
   - Display table preview after upload (first 10 rows)
   - Display statistical results in charts or tables
   - Plan approval with inline editing

5. **Polish investigation panel** (`frontend/src/components/InvestigationPanel.tsx`)
   - Tip input with character counter
   - Recent tips dropdown
   - Run button with loading state
   - Cancel button (abort signal)

6. **Add error handling UI** (`frontend/src/components/ErrorDisplay.tsx`)
   - Display errors with stage context
   - "Retry from failed stage" button
   - Error details expandable

7. **Add global layout** (`frontend/src/components/MainLayout.tsx`)
   - Responsive layout with sidebar navigation
   - Collapsible sidebar on mobile
   - Status bar showing backend connection state

8. **Style with Tailwind CSS**
   - Consistent color scheme (slate/blue for primary, green/yellow/red for confidence)
   - Typography scale for readability
   - Spacing and borders for visual hierarchy
   - Dark mode support (optional but nice)

## Technical Acceptance Criteria (Kimi Code checks)

- [ ] SSE stream stays alive for investigations lasting over 2 minutes
- [ ] Heartbeat events prevent proxy timeouts
- [ ] Agent Stream shows all event types correctly
- [ ] Stage Progress visualizes the pipeline accurately
- [ ] Ingestion panel displays table previews and statistical results
- [ ] Investigation panel has cancel functionality
- [ ] Error display shows retry option
- [ ] Main layout is responsive
- [ ] Tailwind styles are consistent across all components
- [ ] `npx tsc --noEmit` passes

## End-User Acceptance Criteria (User verifies)

- [ ] I can watch a full investigation stream without the connection dropping
- [ ] I can see which agent is running, which KBs are selected, and when Exa is called
- [ ] I can see a visual pipeline diagram showing progress
- [ ] I can click on completed stages to review their outputs
- [ ] I can cancel a running investigation
- [ ] I can retry from a failed stage if an error occurs
- [ ] I can see a table preview after uploading a CSV
- [ ] I can edit the wiki plan inline before approving
- [ ] The UI looks polished and professional on both desktop and mobile

## Sprint Completion Rules

### Do Not Proceed Without UAT Acceptance
You **must not** begin Sprint 7 until **all** Technical Acceptance Criteria and **all** End-User Acceptance Criteria above are checked off. The user must explicitly confirm UAT acceptance.

### Push to Main on UAT Acceptance
Once the user confirms that the UAT Criteria are accepted, push this sprint to the Main branch.

### Update README.md
After completing this sprint and before pushing to Main, update the [README.md](../../README.md) Sprint Status table to mark Sprint 6 as **Complete** and reflect the current project state.
