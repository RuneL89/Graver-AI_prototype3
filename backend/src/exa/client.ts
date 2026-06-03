import { z } from "zod";

export interface ExaSearchParams {
  query: string;
  type?: "auto" | "instant" | "fast" | "deep-lite" | "deep" | "deep-reasoning";
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
  category?: string;
  highlights?: boolean | { numSentences?: number; highlightsPerUrl?: number };
  text?: boolean | { maxCharacters?: number };
  additionalQueries?: string[];
  output_schema?: z.ZodSchema<unknown>;
}

export interface ExaDeepSearchParams extends ExaSearchParams {
  type: "deep" | "deep-reasoning";
}

export interface ExaSearchResult {
  results: Array<{
    id: string;
    title: string;
    url: string;
    publishedDate?: string;
    author?: string;
    score?: number;
    text?: string;
    highlights?: string[];
    summary?: string;
  }>;
  autopromptString?: string;
}

export interface ExaContentResult {
  contents: Array<{
    id: string;
    url: string;
    title?: string;
    author?: string;
    publishedDate?: string;
    text: string;
    highlights?: string[];
  }>;
}

export class ExaClient {
  private apiKey: string;
  private baseUrl = "https://api.exa.ai";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  async search(params: ExaSearchParams): Promise<ExaSearchResult> {
    return this.withJitterRetry(() => this._search(params));
  }

  private async _search(params: ExaSearchParams): Promise<ExaSearchResult> {
    const body: Record<string, unknown> = {
      query: params.query,
      type: params.type ?? "auto",
      numResults: params.numResults ?? 10,
    };

    if (params.includeDomains) body.includeDomains = params.includeDomains;
    if (params.excludeDomains) body.excludeDomains = params.excludeDomains;
    if (params.startPublishedDate)
      body.startPublishedDate = params.startPublishedDate;
    if (params.endPublishedDate)
      body.endPublishedDate = params.endPublishedDate;
    if (params.category) body.category = params.category;
    if (params.additionalQueries)
      body.additionalQueries = params.additionalQueries;

    if (params.highlights) {
      if (typeof params.highlights === "boolean") {
        body.highlights = { numSentences: 3, highlightsPerUrl: 1 };
      } else {
        body.highlights = {
          numSentences: params.highlights.numSentences ?? 3,
          highlightsPerUrl: params.highlights.highlightsPerUrl ?? 1,
        };
      }
    }

    if (params.text) {
      if (typeof params.text === "boolean") {
        body.text = { maxCharacters: 4000 };
      } else {
        body.text = { maxCharacters: params.text.maxCharacters ?? 4000 };
      }
    }

    if (params.output_schema) {
      body.output_schema = params.output_schema;
    }

    const res = await fetch(`${this.baseUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Exa search error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return this.normalizeSearchResult(data);
  }

  // -----------------------------------------------------------------------
  // Deep Search (convenience alias)
  // -----------------------------------------------------------------------

  async deepSearch(params: ExaDeepSearchParams): Promise<ExaSearchResult> {
    return this.search(params);
  }

  // -----------------------------------------------------------------------
  // Contents
  // -----------------------------------------------------------------------

  async getContents(
    urls: string[],
    options?: {
      highlights?: boolean | { numSentences?: number; highlightsPerUrl?: number };
      text?: boolean | { maxCharacters?: number };
    }
  ): Promise<ExaContentResult> {
    return this.withJitterRetry(() => this._getContents(urls, options));
  }

  private async _getContents(
    urls: string[],
    options?: {
      highlights?: boolean | { numSentences?: number; highlightsPerUrl?: number };
      text?: boolean | { maxCharacters?: number };
    }
  ): Promise<ExaContentResult> {
    const body: Record<string, unknown> = { urls };

    if (options?.highlights) {
      if (typeof options.highlights === "boolean") {
        body.highlights = { numSentences: 3, highlightsPerUrl: 1 };
      } else {
        body.highlights = {
          numSentences: options.highlights.numSentences ?? 3,
          highlightsPerUrl: options.highlights.highlightsPerUrl ?? 1,
        };
      }
    }

    if (options?.text) {
      if (typeof options.text === "boolean") {
        body.text = { maxCharacters: 4000 };
      } else {
        body.text = { maxCharacters: options.text.maxCharacters ?? 4000 };
      }
    }

    const res = await fetch(`${this.baseUrl}/contents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Exa contents error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return this.normalizeContentResult(data);
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private normalizeSearchResult(data: any): ExaSearchResult {
    return {
      results:
        data.results?.map((r: any) => ({
          id: r.id ?? "",
          title: r.title ?? "",
          url: r.url ?? "",
          publishedDate: r.publishedDate,
          author: r.author,
          score: r.score,
          text: r.text,
          highlights: r.highlights,
          summary: r.summary,
        })) ?? [],
      autopromptString: data.autopromptString,
    };
  }

  private normalizeContentResult(data: any): ExaContentResult {
    return {
      contents:
        data.contents?.map((c: any) => ({
          id: c.id ?? "",
          url: c.url ?? "",
          title: c.title,
          author: c.author,
          publishedDate: c.publishedDate,
          text: c.text ?? "",
          highlights: c.highlights,
        })) ?? [],
    };
  }

  private async withJitterRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt === maxRetries) break;

        // Jittered backoff: base 1s + random up to 1s, doubled each attempt
        const delay = (1000 + Math.random() * 1000) * 2 ** attempt;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastError!;
  }
}
