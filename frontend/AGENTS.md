# Frontend — Agent Guidance Document

> Durable boundary: React 18 SPA for Graver-AI.

---

## Purpose

React 18 SPA for Graver-AI. User interface for configuration, ingestion, investigation, and wiki browsing.

## Ownership

- `main.tsx` — React entry point (StrictMode, Router, Providers)
- `App.tsx` — route definitions
- `vite.config.ts` — Vite build config and dev-server proxy
- `index.html` — HTML entry

## Local Contracts

- `main.tsx` mounts the app with StrictMode, BrowserRouter, AppProvider, and ConfigProvider.
- `App.tsx` defines routes: Config, Ingest, Investigate, Wiki.
- Vite dev server runs on port 5173 and proxies `/api` to `localhost:3001` with infinite timeout for SSE.
- Tailwind CSS 3 and `@tailwindcss/typography` for styling.
- Icons from `lucide-react` imported individually.
- `localStorage` key `graver_recent_tips` caches recent investigation tips.

## Work Guidance

- Use functional React components with hooks.
- Use Tailwind utility classes for all styling.
- Import icons individually from `lucide-react`.
- Use `.js` extensions in imports (bundler module resolution).
- Shared types are imported from `@graver-ai/shared`.

## Verification

- `npm run dev -w frontend` — starts Vite dev server
- `npm run build -w frontend` — runs `tsc && vite build`
- `npm run typecheck -w frontend` — runs `tsc --noEmit`

## Child DOX Index

- `src/components/` — UI components, panels, modals, graph visualization
- `src/pages/` — Route-level page components
