import { Router } from "express";
import { loadConfig, saveConfig, maskConfig, validateConfig } from "./store.js";
import { LLMClient } from "../llm/client.js";
import { ExaClient } from "../exa/client.js";

const router = Router();

router.get("/config", async (_req, res) => {
  const config = await loadConfig();
  if (!config) {
    return res.status(404).json({ error: "No configuration found" });
  }
  res.json(maskConfig(config));
});

router.post("/config", async (req, res) => {
  const {
    llmProvider,
    llmModel,
    llmApiKey,
    llmBaseUrl,
    exaApiKey,
    maxInvestigationRounds,
    exaSearchType,
  } = req.body;

  const existing = await loadConfig();

  const partial = {
    llmProvider,
    llmModel,
    llmApiKey: llmApiKey || existing?.llmApiKey || "",
    llmBaseUrl: llmBaseUrl ?? existing?.llmBaseUrl,
    exaApiKey: exaApiKey || existing?.exaApiKey || "",
    maxInvestigationRounds: maxInvestigationRounds ?? existing?.maxInvestigationRounds ?? 5,
    exaSearchType: exaSearchType ?? existing?.exaSearchType ?? "fast",
  };

  const validationErrors = validateConfig(partial);
  if (validationErrors.length > 0) {
    return res.status(400).json({ errors: validationErrors });
  }

  try {
    await saveConfig(partial as any);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/config/test-llm", async (req, res) => {
  const { llmProvider, llmModel, llmApiKey, llmBaseUrl } = req.body;

  if (!llmApiKey || !llmModel) {
    return res.status(400).json({ error: "LLM API key and model are required" });
  }

  try {
    const client = new LLMClient({
      provider: llmProvider,
      apiKey: llmApiKey,
      model: llmModel,
      baseUrl: llmBaseUrl,
      timeoutMs: 15_000,
    });

    const response = await client.complete("Say 'hello' and nothing else.");
    res.json({ success: true, response: response.trim() });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

router.post("/config/test-exa", async (req, res) => {
  const { exaApiKey, exaSearchType } = req.body;

  if (!exaApiKey) {
    return res.status(400).json({ error: "Exa API key is required" });
  }

  try {
    const client = new ExaClient(exaApiKey);
    const result = await client.search({
      query: "Exa.ai",
      type: exaSearchType || "fast",
      numResults: 1,
    });
    res.json({ success: true, resultCount: result.results.length });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

router.post("/config/test-llm-saved", async (_req, res) => {
  const config = await loadConfig();
  if (!config) {
    return res.status(404).json({ error: "No saved configuration found" });
  }

  try {
    const client = new LLMClient({
      provider: config.llmProvider,
      apiKey: config.llmApiKey,
      model: config.llmModel,
      baseUrl: config.llmBaseUrl,
      timeoutMs: 15_000,
    });

    const response = await client.complete("Say 'hello' and nothing else.");
    res.json({ success: true, response: response.trim() });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

router.post("/config/test-exa-saved", async (_req, res) => {
  const config = await loadConfig();
  if (!config) {
    return res.status(404).json({ error: "No saved configuration found" });
  }

  try {
    const client = new ExaClient(config.exaApiKey);
    const result = await client.search({
      query: "Exa.ai",
      type: config.exaSearchType,
      numResults: 1,
    });
    res.json({ success: true, resultCount: result.results.length });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

export default router;
