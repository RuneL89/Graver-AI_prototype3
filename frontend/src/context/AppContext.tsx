import React, { createContext, useContext, useReducer, ReactNode } from "react";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface AppState {
  activeTab: "config" | "ingest" | "investigate";
  apiConfig: {
    llmProvider: string;
    llmModel: string;
    llmApiKey: string;
    exaApiKey: string;
  };
}

const initialState: AppState = {
  activeTab: "config",
  apiConfig: {
    llmProvider: "openai",
    llmModel: "gpt-4o",
    llmApiKey: "",
    exaApiKey: "",
  },
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type AppAction =
  | { type: "SET_TAB"; payload: AppState["activeTab"] }
  | { type: "UPDATE_API_CONFIG"; payload: Partial<AppState["apiConfig"]> };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_TAB":
      return { ...state, activeTab: action.payload };
    case "UPDATE_API_CONFIG":
      return { ...state, apiConfig: { ...state.apiConfig, ...action.payload } };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return ctx;
}
