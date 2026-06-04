import { useState, useCallback, useEffect } from "react";
import AgentStream from "./AgentStream";
import DossierViewer from "./DossierViewer";
import ErrorDisplay from "./ErrorDisplay";
import type { Dossier } from "@graver-ai/shared";

const RECENT_TIPS_KEY = "graver_recent_tips";
const MAX_RECENT_TIPS = 10;

function loadRecentTips(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_TIPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentTip(tip: string) {
  const tips = loadRecentTips();
  const filtered = tips.filter((t) => t !== tip);
  filtered.unshift(tip);
  localStorage.setItem(RECENT_TIPS_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT_TIPS)));
}

export default function InvestigationPanel() {
  const [tip, setTip] = useState("");
  const [investigationId, setInvestigationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ status: string; evidenceCount: number; dossier: Dossier | null; error?: string } | null>(null);
  const [recentTips, setRecentTips] = useState<string[]>(loadRecentTips());
  const [showRecentTips, setShowRecentTips] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const runInvestigation = useCallback(async () => {
    const trimmed = tip.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setInvestigationId(null);
    setResults(null);

    try {
      const res = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tip: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start investigation");
      }

      saveRecentTip(trimmed);
      setRecentTips(loadRecentTips());
      setInvestigationId(data.id);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, [tip]);

  const cancelInvestigation = useCallback(async () => {
    if (!investigationId) return;
    setCancelling(true);
    try {
      await fetch(`/api/investigate/${investigationId}`, { method: "DELETE" });
      setLoading(false);
      setCancelling(false);
    } catch {
      setCancelling(false);
    }
  }, [investigationId]);

  const handleRetry = useCallback(async () => {
    if (!investigationId) return;
    setError(null);
    setResults(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/investigate/${investigationId}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to retry investigation");
      }
      setInvestigationId(data.id);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, [investigationId]);

  const handleComplete = useCallback(async () => {
    if (!investigationId) return;
    setLoading(false);

    try {
      const res = await fetch(`/api/investigate/${investigationId}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch {
      // ignore
    }
  }, [investigationId]);

  const selectRecentTip = (t: string) => {
    setTip(t);
    setShowRecentTips(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-recent-tips]")) {
        setShowRecentTips(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="space-y-6">
      {/* Tip Input */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">
            Enter your investigative tip
          </label>
          {recentTips.length > 0 && (
            <div className="relative" data-recent-tips>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRecentTips(!showRecentTips);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Recent tips ▼
              </button>
              {showRecentTips && (
                <div className="absolute right-0 mt-1 w-72 bg-white border rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                  {recentTips.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => selectRecentTip(t)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 truncate"
                      title={t}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <textarea
          className="w-full border rounded px-3 py-2 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="e.g., Danish military equipment exported to Israel and used in Gaza..."
          value={tip}
          onChange={(e) => setTip(e.target.value)}
          disabled={loading && !!investigationId}
        />
        <div className="mt-4 flex justify-between items-center flex-wrap gap-3">
          <p className="text-xs text-gray-500">
            {tip.length} characters
          </p>
          <div className="flex items-center gap-3">
            {loading && investigationId && (
              <button
                onClick={cancelInvestigation}
                disabled={cancelling}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
              >
                {cancelling ? "Cancelling..." : "Cancel"}
              </button>
            )}
            <button
              onClick={runInvestigation}
              disabled={!tip.trim() || (loading && !!investigationId)}
              className="px-6 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && investigationId ? "Running..." : "Run Investigation"}
            </button>
          </div>
        </div>
        {error && !investigationId && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Agent Stream */}
      {investigationId && (
        <AgentStream
          investigationId={investigationId}
          onComplete={handleComplete}
        />
      )}

      {/* Error Display */}
      {results?.error && (
        <ErrorDisplay
          stage="investigation"
          message={results.error}
          onRetry={handleRetry}
          onDismiss={() => setResults((r) => r ? { ...r, error: undefined } : r)}
        />
      )}

      {/* Results Summary */}
      {results && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-3">Investigation Results</h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Status:</span>{" "}
                <span className={results.status === "complete" ? "text-green-600" : "text-red-600"}>
                  {results.status}
                </span>
              </p>
              <p>
                <span className="font-medium">Evidence bundles:</span>{" "}
                {results.evidenceCount}
              </p>
              {results.error && (
                <p className="text-red-600">{results.error}</p>
              )}
            </div>
          </div>

          {results.dossier && (
            <DossierViewer dossier={results.dossier} />
          )}
        </div>
      )}
    </div>
  );
}
