import React, { createContext, useContext, useReducer, ReactNode } from "react";

export interface AppState {
  activeTab: "config" | "ingest" | "investigate";
}

const initialState: AppState = {
  activeTab: "config",
};

type AppAction = { type: "SET_TAB"; payload: AppState["activeTab"] };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_TAB":
      return { ...state, activeTab: action.payload };
    default:
      return state;
  }
}

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
