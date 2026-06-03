import { useAppContext } from "../context/AppContext.js";

export default function ConfigPage() {
  const { state, dispatch } = useAppContext();

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Configuration</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">LLM Provider</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={state.apiConfig.llmProvider}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_API_CONFIG",
                payload: { llmProvider: e.target.value },
              })
            }
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="openrouter">OpenRouter</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">LLM Model</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={state.apiConfig.llmModel}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_API_CONFIG",
                payload: { llmModel: e.target.value },
              })
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">LLM API Key</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={state.apiConfig.llmApiKey}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_API_CONFIG",
                payload: { llmApiKey: e.target.value },
              })
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Exa.ai API Key</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={state.apiConfig.exaApiKey}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_API_CONFIG",
                payload: { exaApiKey: e.target.value },
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
