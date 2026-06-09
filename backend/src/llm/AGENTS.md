# LLM Client — Agent Guidance Document

> Durable boundary: Unified LLM client supporting multiple providers.

---

## Purpose

Unified LLM client supporting OpenAI, Anthropic, Gemini, OpenRouter, and custom endpoints.

## Ownership

- `client.ts` — `LLMClient` class with completion, structured completion, and streaming
- `errors.ts` — typed error classes: `LLMRateLimitError`, `LLMTimeoutError`, `LLMProviderError`

## Local Contracts

- `LLMClient` exposes three methods: `complete()`, `completeStructured()`, and `stream()`.
- Retry with exponential backoff for rate limits (max 3 retries, base delay 1s).
- Timeout via `AbortController` (default 60s). Timer is `unref`'d to prevent keeping the process alive.
- `completeStructured()` retries up to 3 times on JSON parse errors, strips markdown fences, repairs trailing commas, and extracts JSON objects/arrays from surrounding text.
- Errors are normalized to typed classes in `normalizeError()`.

## Work Guidance

- Add new providers by extending the switch statements in `complete()`, `completeStructured()`, and `stream()`.
- Gemini streaming falls back to non-streaming for the prototype.
- Use `completeStructured()` with Zod schemas for all agent skill JSON outputs.
- Keep provider-specific fetch logic isolated within its case block.

## Verification

- Test LLM Connection button on Config page validates connectivity.
- `npm run typecheck -w backend`

## Child DOX Index

None
