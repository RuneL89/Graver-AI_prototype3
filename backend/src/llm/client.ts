import OpenAI from "openai";
import { z } from "zod";
import {
  LLMRateLimitError,
  LLMTimeoutError,
  LLMProviderError,
} from "./errors.js";

export interface LLMClientConfig {
  provider: "openai" | "anthropic" | "gemini" | "openrouter" | "custom";
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
}

interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = config.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      const isRateLimit =
        lastError.message.includes("429") ||
        lastError.message.includes("rate limit") ||
        lastError.message.includes("Rate limit") ||
        (lastError instanceof LLMRateLimitError);

      if (!isRateLimit || attempt === maxRetries) {
        throw lastError;
      }

      const delay = baseDelayMs * 2 ** attempt;
      await sleep(delay);
    }
  }

  throw lastError!;
}

function createAbortController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Prevent timer from keeping process alive
  if (timer.unref) timer.unref();
  return controller;
}

export class LLMClient {
  private config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Non-streaming completion
  // -----------------------------------------------------------------------

  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    return withRetry(() => this._complete(prompt, systemPrompt), {
      maxRetries: DEFAULT_MAX_RETRIES,
    });
  }

  private async _complete(
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    switch (this.config.provider) {
      case "openai":
      case "openrouter":
      case "custom": {
        const client = this.getOpenAIClient();
        const controller = createAbortController(timeoutMs);
        try {
          const response = await client.chat.completions.create(
            {
              model: this.config.model,
              messages: [
                ...(systemPrompt
                  ? [{ role: "system" as const, content: systemPrompt }]
                  : []),
                { role: "user" as const, content: prompt },
              ],
            },
            { signal: controller.signal }
          );
          const content = response.choices[0]?.message?.content;
          if (!content) throw new LLMProviderError("Empty response from LLM");
          return content;
        } catch (err: any) {
          throw this.normalizeError(err);
        }
      }

      case "anthropic": {
        const controller = createAbortController(timeoutMs);
        try {
          const anthropicUrl = this.config.baseUrl || "https://api.anthropic.com/v1";
          const res = await fetch(`${anthropicUrl}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": this.config.apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: this.config.model,
              max_tokens: 4096,
              messages: [
                ...(systemPrompt
                  ? [{ role: "user", content: systemPrompt }]
                  : []),
                { role: "user", content: prompt },
              ],
            }),
            signal: controller.signal,
          });
          if (!res.ok) {
            const body = await res.text();
            throw new LLMProviderError(
              `Anthropic error ${res.status}: ${body}`,
              res.status
            );
          }
          const data = await res.json();
          const content = data.content?.[0]?.text;
          if (!content)
            throw new LLMProviderError("Empty response from Anthropic");
          return content;
        } catch (err: any) {
          throw this.normalizeError(err);
        }
      }

      case "gemini": {
        const controller = createAbortController(timeoutMs);
        const geminiBase = this.config.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
        const url = `${geminiBase}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    ...(systemPrompt ? [{ text: systemPrompt }] : []),
                    { text: prompt },
                  ],
                },
              ],
            }),
            signal: controller.signal,
          });
          if (!res.ok) {
            const body = await res.text();
            throw new LLMProviderError(
              `Gemini error ${res.status}: ${body}`,
              res.status
            );
          }
          const data = await res.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!content)
            throw new LLMProviderError("Empty response from Gemini");
          return content;
        } catch (err: any) {
          throw this.normalizeError(err);
        }
      }

      default:
        throw new LLMProviderError(`Unknown provider: ${this.config.provider}`);
    }
  }

  // -----------------------------------------------------------------------
  // Structured completion
  // -----------------------------------------------------------------------

  async completeStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    systemPrompt?: string
  ): Promise<T> {
    const jsonInstruction =
      "Respond with valid JSON only. Do not include markdown code fences or any explanatory text outside the JSON.";
    const fullSystem = systemPrompt
      ? `${systemPrompt}\n\n${jsonInstruction}`
      : jsonInstruction;

    const raw = await this.complete(prompt, fullSystem);
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned);
    return schema.parse(parsed);
  }

  // -----------------------------------------------------------------------
  // Streaming completion
  // -----------------------------------------------------------------------

  async *stream(
    prompt: string,
    systemPrompt?: string
  ): AsyncGenerator<string> {
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    switch (this.config.provider) {
      case "openai":
      case "openrouter":
      case "custom": {
        const client = this.getOpenAIClient();
        const controller = createAbortController(timeoutMs);
        try {
          const stream = await client.chat.completions.create(
            {
              model: this.config.model,
              messages: [
                ...(systemPrompt
                  ? [{ role: "system" as const, content: systemPrompt }]
                  : []),
                { role: "user" as const, content: prompt },
              ],
              stream: true,
            },
            { signal: controller.signal }
          );

          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) yield content;
          }
        } catch (err: any) {
          throw this.normalizeError(err);
        }
        return;
      }

      case "anthropic": {
        const controller = createAbortController(timeoutMs);
        try {
          const anthropicStreamUrl = this.config.baseUrl || "https://api.anthropic.com/v1";
          const res = await fetch(`${anthropicStreamUrl}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": this.config.apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: this.config.model,
              max_tokens: 4096,
              messages: [
                ...(systemPrompt
                  ? [{ role: "user", content: systemPrompt }]
                  : []),
                { role: "user", content: prompt },
              ],
              stream: true,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const body = await res.text();
            throw new LLMProviderError(
              `Anthropic error ${res.status}: ${body}`,
              res.status
            );
          }

          const reader = res.body?.getReader();
          if (!reader) throw new LLMProviderError("No response body");

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") return;
                try {
                  const parsed = JSON.parse(data);
                  const text = parsed.delta?.text;
                  if (text) yield text;
                } catch {
                  // ignore parse errors for event lines
                }
              }
            }
          }
        } catch (err: any) {
          throw this.normalizeError(err);
        }
        return;
      }

      case "gemini": {
        // Gemini streaming is more complex; fallback to non-streaming for prototype
        const text = await this.complete(prompt, systemPrompt);
        yield text;
        return;
      }

      default:
        throw new LLMProviderError(`Unknown provider: ${this.config.provider}`);
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private getOpenAIClient(): OpenAI {
    const defaultBaseURL =
      this.config.provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : "https://api.openai.com/v1";
    const baseURL = this.config.baseUrl || defaultBaseURL;

    return new OpenAI({
      apiKey: this.config.apiKey,
      baseURL,
      timeout: this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  }

  private normalizeError(err: any): Error {
    if (err.name === "AbortError" || err.message?.includes("abort")) {
      return new LLMTimeoutError();
    }
    if (err.status === 429 || err.message?.includes("429")) {
      return new LLMRateLimitError(err.message);
    }
    return new LLMProviderError(
      err.message || "Unknown LLM error",
      err.status
    );
  }
}
