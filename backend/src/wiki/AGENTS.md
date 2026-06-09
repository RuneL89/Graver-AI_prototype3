# Wiki Store — Agent Guidance Document

> Durable boundary: File-system wiki store for markdown knowledge bases.

---

## Purpose

File-system wiki store for markdown knowledge bases.

## Ownership

- `store.ts` — async file-system operations for wiki pages and KBs

## Local Contracts

- `store.ts` provides async operations: `readPage`, `writePage`, `listPages`, `deletePage`.
- `kbName` is sanitized: `/[^a-zA-Z0-9_-]/g → "_"`.
- Paths containing `..` are rejected.
- Wiki root is `WIKI_PATH` (default `./wiki`).

## Work Guidance

- Always sanitize `kbName` before file operations.
- Write markdown with YAML frontmatter for investigation writebacks.
- Keep page paths relative within the KB directory.

## Verification

- Wiki CRUD through WikiPage UI.
- `npm run typecheck -w backend`

## Child DOX Index

None
