# Sprint 7: Demo Data Preparation & End-to-End Integration

## STEP 0: Read the Supporting Documents

Before running validation, read the relevant documents for context:

- **[DATASETS.md](../DATASETS.md)** — Describes the four demo knowledge bases: what data they contain, how they were created, and why they are needed. This is the primary reference for the ingested data.
- **[FRD_Graver_AI_Prototype.md](../FRD_Graver_AI_Prototype.md)** — Functional Requirements Document
  - **FRD Section 3.2** — Core Feature: Data Ingestion
  - **FRD Section 3.3** — Core Feature: Investigation
  - **FRD Section 7.1** — Performance (under 3 minutes target, SQLite query speed)
  - **FRD Section 7.2** — Error Handling (pipeline stops on failure, retry logic)
- **[IMPLEMENTATION_PLAN_Graver_AI.md](../IMPLEMENTATION_PLAN_Graver_AI.md)** — Sections 6.1 and 6.2 for demo data specifics and integrity check requirements.

> **Note:** The four demo datasets have already been ingested into `backend/data/graver.db` and `backend/wiki/`. The original source CSVs were generated and discarded after ingestion. This sprint focuses on **verification and end-to-end validation**, not data generation.

## Goal

All four demo knowledge bases are verified as correctly ingested, the Gaza tip produces a coherent chain through the actual data topology, the integrity check (cheese exports) passes, and the demo is ready for presentation.

## Implementation Tasks

1. **Verify kb-business (CVR Register) dataset integrity**
   - Confirm table `kb_dk_cvr_entities_ftm_mpzy974w` exists with correct schema (`id`, `caption`, `schema`, `properties`, `referents`, `datasets`, `first_seen`, `last_seen`, `last_change`, `target`)
   - Verify record count is ~2,000,000
   - Confirm `Terma A/S` is present with CVR number `4000501428`
   - Verify wiki pages exist: `index.md`, `legal_entities.md`, `persons.md`, `ownership_structures.md`, `temporal_analyses.md`, `data_quality.md`

2. **Verify kb-licenses (Danish Arms Export Licenses) dataset integrity**
   - Confirm table `kb_kb_licenses_mq0nhcxj` exists with correct schema (`license_number`, `exporter_cvr`, `exporter_name`, `product_category`, `destination_country`, `end_user_country`, `issue_date`, `value_usd`, `status`)
   - Verify record count is 500
   - Confirm Terma A/S has export license records (for non-F-35 products: Radar Systems, Electronic Warfare, Optical Systems, Ammunition, Night Vision Systems)
   - Verify wiki pages exist: `index.md`, `exporters/index.md`, `product_categories/index.md`, `countries/destination.md`, `financials/value_analysis.md`, `licenses/active.md`, `statuses/index.md`

3. **Verify kb-procurement (Defense Procurement Programs) dataset integrity**
   - Confirm table `kb_kb_procurement_mq0nj6d0` exists with correct schema (`program_id`, `program_name`, `component_name`, `supplier_cvr`, `supplier_name`, `contract_value_usd`, `delivery_date`, `participating_countries`)
   - Verify record count is 200
   - Confirm Terma A/S (CVR `4000501428`) is linked to `F-35 Lightning II Joint Strike Fighter` components (e.g., Landing Gear Component, Tactical Data Link Module)
   - Verify wiki pages exist: `index.md`, `procurement-programs-overview.md`, `supplier-and-component-info.md`, `delivery-timeline.md`, `financial-analysis.md`, `international-collaborations.md`

4. **Verify kb-conflicts (Multi-Conflict Civilian Harm Incidents) dataset integrity**
   - Confirm table `kb_kb_conflicts_mq0nkkgu` exists with correct schema (`incident_id`, `date`, `location`, `description`, `munition_type`, `platform_type`, `operator_country`, `source_url`)
   - Verify record count is 500
   - Confirm Gaza incidents with `platform_type = 'F-35I Adir'` exist
   - Verify wiki pages exist: `index.md`, `platform_analysis.md`, `location_impact.md`, `munition_types.md`, `operator_countries.md`, `temporal_analysis.md`

5. **Verify all four knowledge base wikis are coherent**
   - Confirm each KB has a readable `index.md` with accurate data descriptions
   - Spot-check that wikilinks and source citations are present
   - Confirm `_meta.json` files exist for each KB with `displayName` set

6. **Run end-to-end Gaza test**
   - Submit tip: "Investigate whether Danish military equipment contributes to the conflict in Gaza"
   - Verify the agent:
     - Selects relevant KBs: CVR Register, Danish Arms Export Licenses, Defense Procurement Programs, Multi-Conflict Civilian Harm Incidents
     - Finds Terma A/S in the CVR Register
     - **Finds Terma A/S linked to F-35 components in Defense Procurement Programs** (this is the primary chain link)
     - Finds that Israel is a participating country in the F-35 program
     - Finds Gaza incidents in kb-conflicts involving F-35I Adir
     - Resolves the cross-KB chain: **Terma → F-35 program (procurement) → Israel (F-35 participant) → Gaza (F-35I Adir incidents)**
     - Produces a dossier with the expected connections
   - **Important:** The agent may also find Terma's export licenses in kb-licenses, but these are for other products (Radar, EW, Optical, etc.) to other countries. The F-35 → Gaza connection is driven by procurement + conflict data, not by a direct export license from Terma to Israel.
   - Verify the dossier contains all required sections (Executive Summary, Findings, Connections, Gaps, Confidence, Attribution, Next Steps)

7. **Run integrity check (cheese exports)**
   - **FRD Reference: IMPLEMENTATION_PLAN Section 6.2 — Data Integrity**
   - Submit tip: "Investigate Danish cheese exports to France"
   - Verify the agent:
     - Queries kb-business for dairy/food companies (e.g., companies with "mejeri", "dairy", "food" in their name)
     - Queries kb-licenses for food/cheese export licenses
     - Finds no matching export licenses in the arms export license dataset (product categories are defense-related: Aircraft Parts, Ammunition, Naval Systems, etc.)
     - Finds no defense procurement link
     - Finds no conflict incidents
     - Returns a dossier stating "No significant connections found" or similar negative result
   - Verify the agent does NOT return the Gaza story, Terma, or F-35

8. **Run Exa integration test**
   - Submit a tip that requires supplemental web research (e.g., "Investigate Danish defense companies and recent Gaza conflict reporting")
   - Verify Exa deep search is called
   - Verify web evidence is cross-referenced with database evidence
   - Verify Exa results appear in the dossier with proper attribution

9. **Performance validation**
   - Gaza investigation completes in under 3 minutes
   - All SQLite queries execute in under 100ms
   - Agent stream renders smoothly without UI freezing

10. **Pre-Sprint-8 verification**
    - Confirm README.md already contains accurate setup instructions for running the demo
    - Note any missing documentation items to be addressed in Sprint 8 (Documentation & README Finalization)

## Technical Acceptance Criteria (Kimi Code checks)

- [ ] All four KBs are ingested, wiki pages are generated, and dataset integrity is verified
- [ ] Gaza tip produces a dossier with the chain: **Terma → F-35 program (procurement) → Israel (participant) → Gaza (F-35I Adir incidents)**
- [ ] Cheese exports tip produces a "no significant connections" dossier without hallucinating Gaza/F-35/Terma
- [ ] Exa integration test shows web evidence in the dossier
- [ ] Gaza investigation completes in under 3 minutes
- [ ] No SQLite query exceeds 100ms
- [ ] `npm run typecheck` passes (root script, checks all workspaces)
- [ ] No TypeScript or runtime errors during end-to-end tests

## End-User Acceptance Criteria (User verifies)

- [ ] I can see all four knowledge bases in the wiki viewer with proper index pages
- [ ] I can submit the Gaza tip and receive a complete dossier within 3 minutes
- [ ] The dossier shows the expected chain of connections (Terma via procurement to F-35 program, linked to Gaza incidents)
- [ ] I can submit the cheese exports tip and receive a negative result
- [ ] The negative result does not mention Gaza, F-35, or Terma
- [ ] I can see Exa web evidence in the dossier when relevant
- [ ] The demo flow works smoothly from start to finish
- [ ] I am confident showing this to Torben on June 19

## Sprint Completion Rules

### Do Not Proceed Without UAT Acceptance
You **must not** begin Sprint 8 until **all** Technical Acceptance Criteria and **all** End-User Acceptance Criteria above are checked off. The user must explicitly confirm UAT acceptance.

### Push to Main on UAT Acceptance
Once the user confirms that the UAT Criteria are accepted, push this sprint to the Main branch.

### Update README.md
After completing this sprint and before pushing to Main, update the [README.md](../../README.md) Sprint Status table to mark Sprint 7 as **Complete** and reflect the current project state.
