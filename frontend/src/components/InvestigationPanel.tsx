import { useState, useCallback } from "react";
import AgentStream from "./AgentStream";

export default function InvestigationPanel() {
  const [tip, setTip] = useState("");
  const [investigationId, setInvestigationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);

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

      setInvestigationId(data.id);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, [tip]);

  const handleComplete = useCallback(async () => {
    if (!investigationId) return;
    setLoading(false);

    // Fetch final results
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

  return (
    <div className="space-y-6">
      {/* Tip Input */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium mb-2">
          Enter your investigative tip
        </label>
        <textarea
          className="w-full border rounded px-3 py-2 h-32 resize-none focus:outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="e.g., Danish military equipment exported to Israel and used in Gaza..."
          value={tip}
          onChange={(e) => setTip(e.target.value)}
          disabled={loading && !!investigationId}
        />
        <div className="mt-4 flex justify-between items-center">
          <p className="text-xs text-gray-500">
            {tip.length} characters
          </p>
          <button
            onClick={runInvestigation}
            disabled={!tip.trim() || (loading && !!investigationId)}
            className="px-6 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && investigationId ? "Running..." : "Run Investigation"}
          </button>
        </div>
        {error && (
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

      {/* Results Summary */}
      {results && (
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
          <p className="mt-4 text-xs text-gray-500">
            Full dossier synthesis will be available in Sprint 5.
          </p>
        </div>
      )}
    </div>
  );
}
