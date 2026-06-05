# Sprint 2: LLM Client, Exa Client & Configuration

## STEP 0: Read the FRD

Before writing any code, read the relevant sections of the Functional Requirements Document:

- **FRD Section 3.5** — Core Feature: Configuration (provider selection, API keys, validation)
- **FRD Section 4.6** — External Integrations (LLM API abstraction, Exa.ai wrapper)
- **FRD Section 7.2** — Error Handling (exponential backoff, retry logic)
- **FRD Section 7.3** — Security (API keys server-side only, masking)

Refer to [FRD_Graver_AI_Prototype.md](../FRD_Graver_AI_Prototype.md) for full requirement context.

## Goal

The backend can call LLM APIs and Exa APIs. The frontend has a configuration screen where API keys are entered, validated, and persisted.

## Implementation Tasks

1. **Implement LLM client** (`backend/src/llm/client.ts`)
   - Unified interface supporting OpenAI, Anthropic, Gemini, OpenRouter, and custom endpoints
   - Request body normalization per provider
   - Exponential backoff retry on 429/rate-limit errors
   - Max retry count: 3
   - Timeout handling
   - Streaming support: return an async generator that yields reasoning chunks
   - Non-streaming support: return full response
   - Error types: `LLMRateLimitError`, `LLMTimeoutError`, `LLMProviderError`

2. **Implement Exa client** (`backend/src/exa/client.ts`)
   - Wrapper around Exa.ai REST API
   - Methods:
     - `search(params: ExaSearchParams)` — standard/instant search
     - `deepSearch(params: ExaDeepSearchParams)` — deep reasoning search
     - `getContents(urls: string[], options?)` — contents extraction
   - Handles API key from env var `EXA_API_KEY`
   - Retries with jitter on failure
   - Returns typed responses matching Exa API schemas

3. **Implement configuration backend** (`backend/src/config.ts`)
   - Load API keys and provider settings from `.env` and `localStorage`-equivalent file
   - `GET /api/config` returns current settings (without exposing full API keys — mask all but last 4 characters)
   - `POST /api/config` validates and saves settings
   - Validation: API key format checks, endpoint URL format checks, HTTPS enforcement

4. **Implement configuration frontend** (`frontend/src/components/ConfigScreen.tsx`)
   - Form with fields: LLM provider dropdown, API key input, model name input, Exa API key input
   - "Test Connection" buttons for LLM and Exa that make validation calls
   - Save button persists to backend
   - Display masked current settings on load
   - Error messages for invalid inputs or failed test calls

5. **Implement configuration context** (`frontend/src/context/ConfigContext.tsx`)
   - Load config on app mount
   - Provide config values to all components
   - Handle config updates

6. **Create test skill** (`backend/src/skills/testConnectionSkill.ts`)
   - A simple reusable skill that sends a "hello world" prompt to the LLM and returns the response
   - Used by the "Test Connection" button
   - Follows the `AgentSkill` interface defined in Sprint 1

## Technical Acceptance Criteria (Kimi Code checks)

- [ ] LLM client can send a non-streaming prompt to OpenAI and receive a structured response
- [ ] LLM client can send a streaming prompt and yield reasoning chunks
- [ ] LLM client retries 3 times on 429 errors with exponential backoff
- [ ] LLM client throws typed errors for timeout and provider failures
- [ ] Exa client can execute a standard search and return results
- [ ] Exa client can execute a deep search and return results
- [ ] Exa client can fetch contents from a URL
- [ ] `GET /api/config` returns masked keys
- [ ] `POST /api/config` validates and saves settings
- [ ] Config screen renders all fields and test buttons
- [ ] Test connection buttons call the backend and display success/failure
- [ ] `npx tsc --noEmit` passes

## End-User Acceptance Criteria (User verifies)

- [ ] I can open the configuration screen
- [ ] I can enter my OpenAI API key and model name
- [ ] I can enter my Exa API key
- [ ] I can click "Test LLM Connection" and see a successful response
- [ ] I can click "Test Exa Connection" and see a successful response
- [ ] I can save the configuration and see it persisted after refresh
- [ ] I can see that my API keys are masked in the UI

## Sprint Completion Rules

### Do Not Proceed Without UAT Acceptance
You **must not** begin Sprint 3 until **all** Technical Acceptance Criteria and **all** End-User Acceptance Criteria above are checked off. The user must explicitly confirm UAT acceptance.

### Push to Main on UAT Acceptance
Once the user confirms that the UAT Criteria are accepted, push this sprint to the Main branch.

### Update README.md
After completing this sprint and before pushing to Main, update the [README.md](../../README.md) Sprint Status table to mark Sprint 2 as **Complete** and reflect the current project state.
