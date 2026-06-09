# Config — Agent Guidance Document

> Durable boundary: Application configuration persistence and connection testing.

---

## Purpose

Application configuration persistence and LLM/Exa connection testing.

## Ownership

- `store.ts` — Zod-validated JSON config file read/write, key masking
- `routes.ts` — CRUD endpoints and test connection handlers under `/api/config`

## Local Contracts

- `store.ts` reads/writes Zod-validated JSON to `CONFIG_PATH` (default `./data/config.json`).
- API keys are masked when returned to the frontend: first 4 + `****` + last 4.
- Keys are never logged.
- `routes.ts` exposes CRUD and test-connection endpoints.

## Work Guidance

- Update the Zod schema in `store.ts` when adding new config fields.
- Test connection skills (`testConnectionSkill.ts`) validate LLM and Exa independently.
- Always mask keys in any response payload.

## Verification

- Test LLM Connection and Test Exa Connection buttons on Config page.
- `npm run typecheck -w backend`

## Child DOX Index

None
