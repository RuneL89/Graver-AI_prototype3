# Sprint Instructions: Graver-AI Investigative Agent Prototype

## Overview

This document is the anchor for all implementation work on Graver-AI. It tracks the status of every sprint and provides directions to sprint-specific instruction files. Both this file and the [README.md](./README.md) must be updated as sprints progress.

## Sprint Progression Rules

1. **Sequential Implementation Only**: Sprints must be completed in strict numerical order (1 → 2 → 3 → ... → 8). Do not skip ahead. Do not begin a new sprint before the previous one is fully complete.
2. **Acceptance Criteria Gate**: A sprint is not complete until **all** Technical Acceptance Criteria and **all** End-User Acceptance Criteria (UAT) have been met.
3. **User Confirmation Required**: Before moving to the next sprint, the user must explicitly confirm that the UAT Criteria are accepted. Do not proceed without this confirmation.
4. **Push to Main on UAT Acceptance**: Once the user confirms that the UAT Criteria are accepted, push the completed sprint to the Main branch.
5. **README Update on Completion**: After each sprint (1–7), update the [README.md](./README.md) Sprint Status table to mark the completed sprint and reflect the current state.
6. **FRD Reference**: Before starting any sprint, read the relevant sections of the [FRD_Graver_AI_Prototype.md](./FRD_Graver_AI_Prototype.md) as specified in each sprint instruction.

## Sprint Status

| Sprint | Focus | Instruction Location | Status |
|---|---|---|---|
| Sprint 1 | Project Foundation & Backend Shell | [plan/sprint-01-foundation/instruction.md](plan/sprint-01-foundation/instruction.md) | Complete |
| Sprint 2 | LLM Client, Exa Client & Configuration | [plan/sprint-02-clients/instruction.md](plan/sprint-02-clients/instruction.md) | Complete |
| Sprint 3 | Data Ingestion Pipeline (Pipeline A) | [plan/sprint-03-ingestion/instruction.md](plan/sprint-03-ingestion/instruction.md) | Complete |
| Sprint 4 | Investigation Pipeline Core (Pipeline B — Part 1) | [plan/sprint-04-investigation-core/instruction.md](plan/sprint-04-investigation-core/instruction.md) | Not Started |
| Sprint 5 | Investigation Pipeline Completion (Pipeline B — Part 2) | [plan/sprint-05-investigation-completion/instruction.md](plan/sprint-05-investigation-completion/instruction.md) | Not Started |
| Sprint 6 | Real-Time Streaming & UI Panels | [plan/sprint-06-streaming-ui/instruction.md](plan/sprint-06-streaming-ui/instruction.md) | Not Started |
| Sprint 7 | Demo Data Preparation & End-to-End Integration | [plan/sprint-07-demo-integration/instruction.md](plan/sprint-07-demo-integration/instruction.md) | Not Started |
| Sprint 8 | Documentation & README Finalization | [plan/sprint-08-documentation/instruction.md](plan/sprint-08-documentation/instruction.md) | Not Started |

## How to Use This Document

1. Identify the current sprint from the Sprint Status table above.
2. Open the linked `instruction.md` for that sprint.
3. Follow the steps in order, beginning with **STEP 0**.
4. Check off all Technical Acceptance Criteria as you implement.
5. Present the sprint to the user for UAT verification.
6. Once the user confirms UAT acceptance, push to Main, update this file and README.md, and proceed to the next sprint.
