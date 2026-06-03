import fs from "fs/promises";
import path from "path";
import { z } from "zod";

const CONFIG_PATH = process.env.CONFIG_PATH || "./data/config.json";

const ConfigSchema = z.object({
  llmProvider: z.enum(["openai", "anthropic", "gemini", "openrouter", "custom"]),
  llmModel: z.string().min(1),
  llmApiKey: z.string().min(1),
  llmBaseUrl: z.string().optional(),
  exaApiKey: z.string().min(1),
  maxInvestigationRounds: z.number().int().min(1).max(10).default(5),
  exaSearchType: z.enum(["instant", "fast", "deep"]).default("fast"),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export interface MaskedConfig {
  llmProvider: string;
  llmModel: string;
  llmApiKey: string; // masked
  llmBaseUrl?: string;
  exaApiKey: string; // masked
  maxInvestigationRounds: number;
  exaSearchType: "instant" | "fast" | "deep";
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  return fs.mkdir(dir, { recursive: true });
}

function maskKey(key: string): string {
  if (key.length <= 8) return "********";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

export async function loadConfig(): Promise<AppConfig | null> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return ConfigSchema.parse(parsed);
  } catch (err: any) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await ensureDir(CONFIG_PATH);
  const validated = ConfigSchema.parse(config);
  await fs.writeFile(CONFIG_PATH, JSON.stringify(validated, null, 2), "utf-8");
}

export function maskConfig(config: AppConfig): MaskedConfig {
  return {
    llmProvider: config.llmProvider,
    llmModel: config.llmModel,
    llmApiKey: maskKey(config.llmApiKey),
    llmBaseUrl: config.llmBaseUrl,
    exaApiKey: maskKey(config.exaApiKey),
    maxInvestigationRounds: config.maxInvestigationRounds,
    exaSearchType: config.exaSearchType,
  };
}

export function validateConfig(config: Partial<AppConfig>): string[] {
  const errors: string[] = [];

  if (config.llmProvider === "custom" && !config.llmBaseUrl) {
    errors.push("Custom provider requires a base URL");
  }
  if (config.llmBaseUrl && !config.llmBaseUrl.startsWith("https://")) {
    errors.push("Base URL must use HTTPS");
  }
  if (config.llmApiKey && config.llmApiKey.length < 4) {
    errors.push("LLM API key is too short");
  }
  if (config.exaApiKey && config.exaApiKey.length < 4) {
    errors.push("Exa API key is too short");
  }

  return errors;
}
