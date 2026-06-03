import React, { createContext, useContext, useReducer, ReactNode, useEffect } from "react";

export interface ConfigState {
  llmProvider: "openai" | "anthropic" | "gemini" | "openrouter" | "custom";
  llmModel: string;
  llmApiKey: string;
  llmBaseUrl: string;
  exaApiKey: string;
  maxInvestigationRounds: number;
  exaSearchType: "instant" | "fast" | "deep";
  loaded: boolean;
}

const initialState: ConfigState = {
  llmProvider: "openai",
  llmModel: "gpt-4o",
  llmApiKey: "",
  llmBaseUrl: "",
  exaApiKey: "",
  maxInvestigationRounds: 5,
  exaSearchType: "fast",
  loaded: false,
};

type ConfigAction =
  | { type: "SET_CONFIG"; payload: Partial<ConfigState> }
  | { type: "SET_LOADED"; payload: boolean };

function configReducer(state: ConfigState, action: ConfigAction): ConfigState {
  switch (action.type) {
    case "SET_CONFIG":
      return { ...state, ...action.payload };
    case "SET_LOADED":
      return { ...state, loaded: action.payload };
    default:
      return state;
  }
}

interface ConfigContextValue {
  state: ConfigState;
  dispatch: React.Dispatch<ConfigAction>;
  refreshConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(configReducer, initialState);

  async function refreshConfig() {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const data = await res.json();
        dispatch({
          type: "SET_CONFIG",
          payload: {
            llmProvider: data.llmProvider,
            llmModel: data.llmModel,
            llmApiKey: data.llmApiKey,
            llmBaseUrl: data.llmBaseUrl || "",
            exaApiKey: data.exaApiKey,
            maxInvestigationRounds: data.maxInvestigationRounds,
            exaSearchType: data.exaSearchType,
          },
        });
      }
    } catch {
      // ignore — config may not exist yet
    } finally {
      dispatch({ type: "SET_LOADED", payload: true });
    }
  }

  useEffect(() => {
    refreshConfig();
  }, []);

  return (
    <ConfigContext.Provider value={{ state, dispatch, refreshConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfigContext(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error("useConfigContext must be used within ConfigProvider");
  }
  return ctx;
}
