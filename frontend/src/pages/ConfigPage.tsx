import { useState, useEffect } from "react";
import { useConfigContext, type ConfigState } from "../context/ConfigContext.js";

type TestStatus = "idle" | "loading" | "success" | "error";

export default function ConfigPage() {
  const { state, refreshConfig } = useConfigContext();

  const [localProvider, setLocalProvider] = useState(state.llmProvider);
  const [localModel, setLocalModel] = useState(state.llmModel);
  const [localLlmKey, setLocalLlmKey] = useState("");
  const [localBaseUrl, setLocalBaseUrl] = useState(state.llmBaseUrl);

  const providerDefaults: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    openrouter: "https://openrouter.ai/api/v1",
    anthropic: "https://api.anthropic.com/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta",
    custom: "",
  };
  const [localExaKey, setLocalExaKey] = useState("");
  const [localRounds, setLocalRounds] = useState(state.maxInvestigationRounds);
  const [localExaType, setLocalExaType] = useState(state.exaSearchType);

  const [llmTestStatus, setLlmTestStatus] = useState<TestStatus>("idle");
  const [llmTestMessage, setLlmTestMessage] = useState("");
  const [exaTestStatus, setExaTestStatus] = useState<TestStatus>("idle");
  const [exaTestMessage, setExaTestMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState<TestStatus>("idle");
  const [saveMessage, setSaveMessage] = useState("");

  // Sync non-sensitive fields from saved config when it loads
  useEffect(() => {
    if (state.loaded) {
      setLocalProvider(state.llmProvider);
      setLocalModel(state.llmModel);
      setLocalBaseUrl(state.llmBaseUrl);
      setLocalRounds(state.maxInvestigationRounds);
      setLocalExaType(state.exaSearchType);
    }
  }, [state.loaded, state.llmProvider, state.llmModel, state.llmBaseUrl, state.maxInvestigationRounds, state.exaSearchType]);

  async function handleSave() {
    setSaveStatus("loading");
    setSaveMessage("");
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llmProvider: localProvider,
          llmModel: localModel,
          llmApiKey: localLlmKey,
          llmBaseUrl: localBaseUrl || undefined,
          exaApiKey: localExaKey,
          maxInvestigationRounds: localRounds,
          exaSearchType: localExaType,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveStatus("error");
        setSaveMessage(data.errors?.join(", ") || data.error || "Save failed");
        return;
      }
      setSaveStatus("success");
      setSaveMessage("Configuration saved successfully.");
      // Clear key inputs after save so they don't re-submit on next save
      setLocalLlmKey("");
      setLocalExaKey("");
      await refreshConfig();
    } catch (err: any) {
      setSaveStatus("error");
      setSaveMessage(err.message || "Network error");
    }
  }

  async function handleTestLLM() {
    setLlmTestStatus("loading");
    setLlmTestMessage("");
    try {
      const url = localLlmKey ? "/api/config/test-llm" : "/api/config/test-llm-saved";
      const body = localLlmKey
        ? JSON.stringify({
            llmProvider: localProvider,
            llmModel: localModel,
            llmApiKey: localLlmKey,
            llmBaseUrl: localBaseUrl || undefined,
          })
        : undefined;

      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLlmTestStatus("error");
        setLlmTestMessage(data.error || "LLM test failed");
        return;
      }
      setLlmTestStatus("success");
      setLlmTestMessage(`Response: ${data.response}`);
    } catch (err: any) {
      setLlmTestStatus("error");
      setLlmTestMessage(err.message || "Network error");
    }
  }

  async function handleTestExa() {
    setExaTestStatus("loading");
    setExaTestMessage("");
    try {
      const url = localExaKey ? "/api/config/test-exa" : "/api/config/test-exa-saved";
      const body = localExaKey
        ? JSON.stringify({ exaApiKey: localExaKey, exaSearchType: localExaType })
        : undefined;

      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setExaTestStatus("error");
        setExaTestMessage(data.error || "Exa test failed");
        return;
      }
      setExaTestStatus("success");
      setExaTestMessage(`Found ${data.resultCount} result(s).`);
    } catch (err: any) {
      setExaTestStatus("error");
      setExaTestMessage(err.message || "Network error");
    }
  }

  const hasSavedLlmKey = state.loaded && state.llmApiKey.includes("****");
  const hasSavedExaKey = state.loaded && state.exaApiKey.includes("****");

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Configuration</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-5">
        {/* LLM Provider */}
        <div>
          <label className="block text-sm font-medium mb-1">LLM Provider</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={localProvider}
            onChange={(e) => {
              const newProvider = e.target.value as ConfigState["llmProvider"];
              setLocalProvider(newProvider);
              setLocalBaseUrl(providerDefaults[newProvider]);
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="openrouter">OpenRouter</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-medium mb-1">LLM Model</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={localModel}
            onChange={(e) => setLocalModel(e.target.value)}
            placeholder="e.g., gpt-4o, claude-3-5-sonnet-20241022"
          />
        </div>

        {/* LLM API Key */}
        <div>
          <label className="block text-sm font-medium mb-1">LLM API Key</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={localLlmKey}
            onChange={(e) => setLocalLlmKey(e.target.value)}
            placeholder={hasSavedLlmKey ? "Key saved — enter new key to replace" : "Enter API key"}
          />
          {hasSavedLlmKey && (
            <p className="text-xs text-gray-500 mt-1">
              Saved (masked): {state.llmApiKey}
            </p>
          )}
        </div>

        {/* Base URL */}
        <div>
          <label className="block text-sm font-medium mb-1">Base URL</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={localBaseUrl}
            onChange={(e) => setLocalBaseUrl(e.target.value)}
            placeholder={providerDefaults[localProvider]}
          />
          <p className="text-xs text-gray-500 mt-1">
            Default for {localProvider}: {providerDefaults[localProvider] || "(user-defined)"}
          </p>
        </div>

        {/* Test LLM */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestLLM}
            disabled={llmTestStatus === "loading" || (!localLlmKey && !hasSavedLlmKey)}
            className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {llmTestStatus === "loading" ? "Testing..." : "Test LLM Connection"}
          </button>
          {!localLlmKey && hasSavedLlmKey && (
            <span className="text-xs text-gray-500">(uses saved key)</span>
          )}
          {llmTestStatus === "success" && (
            <span className="text-sm text-green-600">{llmTestMessage}</span>
          )}
          {llmTestStatus === "error" && (
            <span className="text-sm text-red-600">{llmTestMessage}</span>
          )}
        </div>

        {/* Exa API Key */}
        <div className="pt-4 border-t">
          <label className="block text-sm font-medium mb-1">Exa.ai API Key</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={localExaKey}
            onChange={(e) => setLocalExaKey(e.target.value)}
            placeholder={hasSavedExaKey ? "Key saved — enter new key to replace" : "Enter API key"}
          />
          {hasSavedExaKey && (
            <p className="text-xs text-gray-500 mt-1">
              Saved (masked): {state.exaApiKey}
            </p>
          )}
        </div>

        {/* Test Exa */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestExa}
            disabled={exaTestStatus === "loading" || (!localExaKey && !hasSavedExaKey)}
            className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {exaTestStatus === "loading" ? "Testing..." : "Test Exa Connection"}
          </button>
          {!localExaKey && hasSavedExaKey && (
            <span className="text-xs text-gray-500">(uses saved key)</span>
          )}
          {exaTestStatus === "success" && (
            <span className="text-sm text-green-600">{exaTestMessage}</span>
          )}
          {exaTestStatus === "error" && (
            <span className="text-sm text-red-600">{exaTestMessage}</span>
          )}
        </div>

        {/* Investigation Settings */}
        <div className="pt-4 border-t grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Max Rounds</label>
            <input
              type="number"
              min={1}
              max={10}
              className="w-full border rounded px-3 py-2"
              value={localRounds}
              onChange={(e) => setLocalRounds(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Exa Search Type</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={localExaType}
              onChange={(e) => setLocalExaType(e.target.value as ConfigState["exaSearchType"])}
            >
              <option value="instant">Instant (~250ms)</option>
              <option value="fast">Fast (~450ms)</option>
              <option value="deep">Deep (4–15s)</option>
            </select>
          </div>
        </div>

        {/* Save */}
        <div className="pt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saveStatus === "loading"}
            className="px-6 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {saveStatus === "loading" ? "Saving..." : "Save Configuration"}
          </button>
          {saveStatus === "success" && (
            <span className="text-sm text-green-600">{saveMessage}</span>
          )}
          {saveStatus === "error" && (
            <span className="text-sm text-red-600">{saveMessage}</span>
          )}
        </div>
      </div>
    </div>
  );
}
