# Sprint 7: Demo Data Preparation & End-to-End Integration

## STEP 0: Read the FRD

Before writing any code, read the relevant sections of the Functional Requirements Document:

- **FRD Section 3.2** — Core Feature: Data Ingestion (lazy entity generation, wiki plan approval)
- **FRD Section 3.3** — Core Feature: Investigation (full pipeline, dossier content)
- **FRD Section 7.1** — Performance (under 3 minutes target, SQLite query speed)
- **FRD Section 7.2** — Error Handling (pipeline stops on failure, retry logic)

Also consult the Implementation Plan sections 6.1 and 6.2 for demo data specifics and integrity check requirements.

Refer to [FRD_Graver_AI_Prototype.md](../../FRD_Graver_AI_Prototype.md) for full requirement context.

## Goal

All four demo knowledge bases are ingested, the Gaza tip produces the expected chain, the integrity check passes, and the demo is ready.

## Implementation Tasks

1. **Prepare kb-business dataset**
   - **FRD Reference: Section 6.1 — kb-business**
   - Load real Danish CVR data from OpenSanctions
   - Filter to a manageable subset (e.g., 1,000-5,000 companies) including defense-related entries
   - Ensure Terma or similar defense companies are present
   - Export as CSV for ingestion

2. **Prepare kb-licenses dataset**
   - **FRD Reference: Section 6.1 — kb-licenses**
   - Create synthetic export license records
   - Schema: license_number, exporter_cvr, product_category, destination_country, end_user_country, issue_date, value_usd
   - Include records linking Terma's CVR to F-35 component exports to US with Israel as end-user
   - Include other realistic records for noise (exports to other countries, other products)
   - Export as CSV

3. **Prepare kb-procurement dataset**
   - **FRD Reference: Section 6.1 — kb-procurement**
   - Load real F-35 program framework data (program name, participating countries)
   - Create synthetic component records: component_name, program_id, supplier_cvr, contract_value, delivery_date
   - Link Terma's CVR to specific F-35 components
   - Include other suppliers for noise
   - Export as CSV

4. **Prepare kb-conflicts dataset**
   - **FRD Reference: Section 6.1 — kb-conflicts**
   - Extract real subset from Airwars Gaza incident database
   - Schema: incident_id, date, location, description, munition_type, platform_type, operator_country, source_url
   - Include incidents where platform_type references F-35 or Israeli Air Force
   - Export as CSV

5. **Ingest all four knowledge bases**
   - Run Pipeline A for each dataset
   - Approve each wiki plan
   - Verify wiki pages are generated correctly
   - Verify index pages describe the data accurately

6. **Run end-to-end Gaza test**
   - Submit tip: "Investigate whether Danish military equipment contributes to the conflict in Gaza"
   - Verify the agent:
     - Selects kb-business, kb-licenses, kb-procurement, kb-conflicts
     - Finds Terma in kb-business
     - Finds export licenses linking Terma to F-35 components to US/Israel
     - Finds F-35 components in kb-procurement
     - Finds Gaza incidents in kb-conflicts
     - Resolves the cross-KB chain
     - Produces a dossier with the expected connections
   - Verify the dossier contains all required sections

7. **Run integrity check (cheese exports)**
   - **FRD Reference: Section 6.2 — Data Integrity**
   - Submit tip: "Investigate Danish cheese exports to France"
   - Verify the agent:
     - Queries kb-business for dairy companies
     - Queries kb-licenses for food exports
     - Finds no defense procurement link
     - Finds no conflict incidents
     - Returns a dossier stating "No significant connections found"
   - Verify the agent does NOT return the Gaza story

8. **Run Exa integration test**
   - Submit a tip that requires supplemental web research
   - Verify Exa deep search is called
   - Verify web evidence is cross-referenced with database evidence
   - Verify Exa results appear in the dossier with proper attribution

9. **Performance validation**
   - Gaza investigation completes in under 3 minutes
   - All SQLite queries execute in under 100ms
   - Agent stream renders smoothly without UI freezing

10. **Documentation**
    - Update README with setup instructions
    - Document the demo flow
    - Document API endpoints

## Technical Acceptance Criteria (Kimi Code checks)

- [ ] All four KBs are ingested and wiki pages are generated
- [ ] Gaza tip produces a dossier with the Terma → F-35 → Israel → Gaza chain
- [ ] Cheese exports tip produces a "no significant connections" dossier
- [ ] Exa integration test shows web evidence in the dossier
- [ ] Gaza investigation completes in under 3 minutes
- [ ] No SQLite query exceeds 100ms
- [ ] All tests pass without errors
- [ ] README contains accurate setup instructions
- [ ] `npx tsc --noEmit` passes

## End-User Acceptance Criteria (User verifies)

- [ ] I can see all four knowledge bases in the wiki viewer with proper index pages
- [ ] I can submit the Gaza tip and receive a complete dossier within 3 minutes
- [ ] The dossier shows the expected chain of connections
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
