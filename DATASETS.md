# Demo Datasets

This document describes the four knowledge base datasets used in the Graver-AI prototype demo. Each dataset includes a description of what kind of data it is, how it was created, and why it is needed for the investigative agent.

\---

## 1\. CVR\_Register\_OpenSanctions\_FtM

**Status:** REAL DATA  
**Source:** OpenSanctions Danish CVR Register  
**Records:** \~2,000,000 (subset of full register used for prototype)

### What Kind of Data This Is

This is the official Danish Central Business Register (CVR), which contains all registered businesses in Denmark. Each record includes the company's legal name, CVR number (unique 8-digit identifier), industry classification, address, and registered directors. The CVR is the authoritative source of business entity information in Denmark and is maintained by the Danish Business Authority.

### How It Was Created

The data was extracted from OpenSanctions, which aggregates and normalizes official registries from multiple jurisdictions. OpenSanctions sources the CVR data directly from the Danish government's public distribution endpoint (`distribution.virk.dk`). The dataset includes both `LegalEntity` records (companies) and `Person` records (directors/owners), linked through `Ownership` relationships.

### Why It's Needed

The business registry is the starting point of any investigation tracing corporate activity. It answers the question: "Which Danish companies exist, and what do they do?" Without this, the agent cannot identify that Terma A/S is a Danish defense company or that it has a specific CVR number. The CVR number is the shared key that links this dataset to export licenses and procurement records.

\---

## 2\. Danish Arms Export Licenses

**Status:** SYNTHETIC  
**Source:** Modeled on Danish National Police annual statistics and SIPRI arms trade data  
**Records:** 500

### What Kind of Data This Is

This dataset represents individual Danish arms export licenses. Each record includes a license number, the exporting company's CVR number and name, the product category (e.g., F-35 Components, Ammunition, Radar Systems), the destination country, the end-user country (which may differ from the destination in re-export scenarios), the issue date, the value in USD, and the license status.

### How It Was Created

**This data is synthetic because Denmark does not publish individual export license records.** The Danish National Police publishes only annual aggregated statistics (total licenses by destination country, broad product categories, total values). Individual records with company names and specific products are classified as business confidential.

The synthetic dataset was created as follows:

* **Real companies:** All exporter names and CVR numbers are real Danish companies from the CVR register. Terma A/S (CVR 4000501428) is a real Danish defense/aerospace company.
* **Realistic product categories:** Based on known Danish defense export categories (aerospace components, naval systems, electronics, ammunition).
* **Realistic destinations:** Based on Denmark's actual arms export partners (US, NATO allies, Middle Eastern countries).
* **Realistic values:** Defense exports range from $500K to $50M; non-defense exports range from $10K to $5M.
* **Key chain records:** 3 licenses link Terma → F-35 Components → US → Israel (the Gaza chain).
* **Noise records:** 497 additional licenses across 65 companies, 17 product categories, and 38 destination countries to prevent the dataset from being a single-row giveaway.
* **Status distribution:** 55% ACTIVE, 25% EXPIRED, 10% SUSPENDED, 10% PENDING.

### Why It's Needed

Export licenses are the critical link between Danish defense companies and foreign military operations. They answer the question: "What military equipment is Denmark exporting, and to whom?" Without this data, the agent cannot determine whether a Danish company's products are reaching conflict zones. This is the "smoking gun" data that investigative journalists like Danwatch had to uncover through FOIA requests and leaked documents. The dataset is synthetic to demonstrate what the agent would discover if it had access to the real license register.

\---

## 3\. Defense Procurement Programs

**Status:** MIXED — REAL PROGRAM FRAMEWORK + SYNTHETIC COMPONENT RECORDS  
**Source:** Lockheed Martin public disclosures, NATO procurement announcements, manufacturer websites  
**Records:** 200

### What Kind of Data This Is

This dataset contains defense procurement program data. It has two levels of granularity:

1. **Program framework records:** High-level program information (program name, participating countries, lead contractor) for major multinational weapons programs.
2. **Component records:** Supplier-level data showing which specific company supplies which component to which program, including contract values and delivery dates.

### How It Was Created

**Program framework data is real.** The F-35 Lightning II program, NH90 helicopter, IRIS-T air defense, and other programs listed are real multinational procurement programs. Denmark's participation in these programs is publicly documented by the manufacturers and the Danish Ministry of Defence.

**Component-level supply chain records are synthetic.** While it is publicly known that Terma A/S supplies components to the F-35 program, the specific contract values, delivery dates, and component names are not published in any accessible structured database. This granularity is typically protected by commercial confidentiality agreements between the prime contractor (Lockheed Martin) and its suppliers.

The synthetic component records were created as follows:

* **10 real programs** with publicly known frameworks and participating countries
* **15 real Danish suppliers** with CVR numbers from the business registry
* **Component names** matched to supplier specialties (aerospace, naval, electronics, weapons)
* **Contract values** based on typical defense subcontractor ranges ($500K to $35M)
* **Delivery dates** spanning 2020-2026
* **Key chain records:** 6 components link Terma A/S to the F-35 program
* **Noise records:** 194 additional components across 10 programs and 15 suppliers

### Why It's Needed

Procurement data reveals which Danish companies are embedded in major weapons programs. It answers the question: "What military platforms is this company supplying?" Without this, the agent cannot trace a company's products from the factory to a specific weapons platform (e.g., F-35) that might be used in a conflict zone. The program framework data is real to ground the investigation in factual programs; the component records are synthetic to demonstrate the agent's ability to trace supply chains at a granularity that is not publicly available.

\---

## 4\. Multi-Conflict Civilian Harm Incidents

**Status:** BASED ON AIRWARS STRUCTURE AND PATTERNS (MULTIPLE CONFLICTS)  
**Source:** Airwars civilian harm database methodology and documented incident patterns  
**Records:** 500

### What Kind of Data This Is

This dataset documents civilian harm incidents from military actions across six different conflict zones. Each record includes an incident ID, date, location, description, munition type, platform type (aircraft/weapon system used), operator country, and source URL. The dataset spans multiple conflicts to test the agent's ability to distinguish relevant incidents from noise.

### How It Was Created

This dataset is **based on the structure and methodology of the Airwars civilian harm database** (airwars.org), which is the world's leading open-source monitor of civilian harm from military actions. Airwars maintains a public archive documenting incidents across Iraq, Syria, Libya, Yemen, Gaza, and other conflicts. Each incident in their database undergoes a multi-stage review process including primary language monitoring, geolocation, and casualty assessment.

The dataset was created as follows:

* **Gaza incidents (150 records):** Modeled on Airwars' documented patterns from the Israeli military campaign in Gaza since October 2023. Locations, munition types, and platform types reflect real patterns documented by Airwars researchers. 40% of Gaza incidents involve F-35I Adir operations.
* **Iraq/Syria incidents (100 records):** Modeled on the US-led coalition campaign against ISIS (2014-2019). Locations include Mosul, Raqqa, and other major battle sites. Platforms reflect coalition aircraft (F-16, F-15E, B-1B, etc.).
* **Syria incidents (100 records):** Modeled on Russian Aerospace Forces actions in Syria (2015-2024). Locations include Aleppo, Idlib, Homs, and other Syrian cities. Platforms reflect Russian aircraft (Su-24, Su-25, Su-34, etc.).
* **Yemen incidents (80 records):** Modeled on the Saudi-led coalition campaign in Yemen (2015-2022). Locations include Sana'a, Hodeidah, Aden, and other Yemeni cities.
* **Libya incidents (40 records):** Modeled on various actor interventions in the Libyan civil conflict (2019-2020). Multiple operators (UAE, Turkey, Egypt, France, Russia).
* **Ukraine incidents (30 records):** Modeled on Russian military actions in Ukraine (2022-2024). Locations include Mariupol, Bucha, Kharkiv, Bakhmut, and other Ukrainian cities.

**Important:** The specific incident IDs, source URLs, and some descriptions are synthetic for the prototype. For production use, download the real Airwars dataset from airwars.org. The dates, locations, munition types, and platform types are realistic based on Airwars' documented patterns across all six conflicts.

### Why It's Needed

Conflict incident data is the endpoint of the investigative chain. It answers the question: "Where and how is this military equipment being used?" Without this, the agent cannot verify whether exported equipment reaches active conflict zones or distinguish between legitimate defense use and civilian harm. The multi-conflict design is intentional: it tests whether the agent can find the relevant Gaza incidents among hundreds of unrelated incidents from Iraq, Syria, Yemen, Libya, and Ukraine. This is what makes the prototype generically useful rather than a hardcoded Gaza demo.



