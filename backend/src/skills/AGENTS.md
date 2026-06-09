# Skills — Agent Guidance Document

> Durable boundary: AgentSkill implementations — prompts, Zod schemas, and execution logic.

---

## Purpose

AgentSkill implementations — prompts, Zod schemas, and execution logic for each pipeline stage.

## Ownership

All `.ts` files in this directory. Each file exports one skill following the `AgentSkill` contract.

## Local Contracts

- Every skill follows the `AgentSkill<Input, Output>` contract: `name`, `description`, `inputSchema`, `outputSchema`, `execute()`.
- Skills use `context.llmClient.completeStructured()` with Zod schemas for JSON output.
- Many skills use a lenient `rawOutputSchema` to accept LLM field name variations, then normalize to a strict `outputSchema`.
- Skills must not depend on Express routes, LangGraph state, or UI components.
- Skills emit reasoning via `context.emitReasoning?.(chunk)`.

Current skills:
- `tipDecomposerSkill` — breaks tip into sub-claims
- `kbNavigatorSkill` — assigns KBs per sub-claim
- `queryGeneratorSkill` — creates SQL or Exa queries
- `entityResolverSkill` — finds cross-source connections
- `evidenceSynthesizerSkill` — assembles narratives with confidence ratings
- `gapAuditorSkill` — decides CONTINUE, STOP_COMPLETE, or STOP_WITH_GAPS
- `gapDiscoverySkill` — suggests follow-up queries when gaps exist
- `dossierAssemblerSkill` — formats final dossier
- `wikiWritebackSkill` — files findings into wiki with YAML frontmatter
- `statisticalProfilerSkill` — generates SQL profiling queries from schema
- `wikiArchitectSkill` — drafts wiki plan
- `wikiWriterSkill` — generates final markdown
- `wikiPlanModifierSkill` — modifies wiki plans
- `testConnectionSkill` — validates LLM/Exa connectivity

## Work Guidance

- Use `.js` extensions in imports. Import types from `@graver-ai/shared`.
- Keep prompts focused and explicit about JSON output requirements.
- Normalize LLM output field variations at the skill level before returning.
- Do not add Express or LangGraph imports in skills.

## Verification

- `npm run typecheck -w backend`
- End-to-end investigation flows through UI

## Child DOX Index

None
