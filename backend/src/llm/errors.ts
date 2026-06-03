export class LLMRateLimitError extends Error {
  constructor(message = "LLM rate limit exceeded") {
    super(message);
    this.name = "LLMRateLimitError";
  }
}

export class LLMTimeoutError extends Error {
  constructor(message = "LLM request timed out") {
    super(message);
    this.name = "LLMTimeoutError";
  }
}

export class LLMProviderError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "LLMProviderError";
    this.statusCode = statusCode;
  }
}
