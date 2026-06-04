import { useState, useCallback, useEffect } from "react";

type UploadStatus = "idle" | "uploading" | "profiling" | "executing" | "planning" | "awaiting_approval" | "writing" | "complete" | "error";
type ActionStatus = "idle" | "loading" | "success" | "error";

interface WikiPlan {
  indexContent: string;
  proposedPages: Array<{ path: string; title: string; rationale: string }>;
  linkageHints: string[];
}

export default function IngestionPanel() {
  const [dragActive, setDragActive] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState("");
  const [editedPlan, setEditedPlan] = useState<WikiPlan | null>(null);
  const [profilingResults, setProfilingResults] = useState<any[] | null>(null);
  const [pagesWritten, setPagesWritten] = useState(0);
  const [wikiName, setWikiName] = useState("");
  const [existingKbs, setExistingKbs] = useState<{ name: string; displayName: string }[]>([]);
  const [targetKb, setTargetKb] = useState<string>("");
  const [modifyPrompt, setModifyPrompt] = useState("");
  const [modifyStatus, setModifyStatus] = useState<ActionStatus>("idle");
  const [modifyMessage, setModifyMessage] = useState("");

  useEffect(() => {
    fetch("/api/wiki")
      .then((r) => r.json())
      .then((data) => setExistingKbs(data.knowledgeBases || []))
      .catch(() => setExistingKbs([]));
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const runPipeline = useCallback(async (id: number) => {
    // Step 1: Profile
    setStatus("profiling");
    const profileRes = await fetch(`/api/ingest/profile/${id}`, { method: "POST" });
    const profileData = await profileRes.json();
    if (!profileRes.ok || !profileData.success) {
      setStatus("error");
      setError(profileData.error || "Profiling failed");
      return;
    }

    // Step 2: Execute queries
    setStatus("executing");
    const execRes = await fetch(`/api/ingest/execute/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queries: profileData.queries }),
    });
    const execData = await execRes.json();
    if (!execRes.ok || !execData.success) {
      setStatus("error");
      setError(execData.error || "Query execution failed");
      return;
    }
    setProfilingResults(execData.results);

    // Step 3: Architect
    setStatus("planning");
    const archRes = await fetch(`/api/ingest/architect/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profilingResults: execData.results }),
    });
    const archData = await archRes.json();
    if (!archRes.ok || !archData.success) {
      setStatus("error");
      setError(archData.error || "Architect failed");
      return;
    }

    setEditedPlan(JSON.parse(JSON.stringify(archData.plan)));
    setStatus("awaiting_approval");
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    setStatus("uploading");
    setError("");
    setEditedPlan(null);
    setProfilingResults(null);
    setPagesWritten(0);

    const formData = new FormData();
    formData.append("file", file);
    const effectiveName = targetKb || wikiName.trim();
    if (effectiveName) {
      formData.append("wikiName", effectiveName);
    }

    try {
      const res = await fetch("/api/ingest/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatus("error");
        setError(data.error || "Upload failed");
        return;
      }

      setJobId(data.jobId);
      await runPipeline(data.jobId);
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Network error");
    }
  }, [targetKb, wikiName, runPipeline]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }, [uploadFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }, [uploadFile]);

  async function handleApprove() {
    if (!jobId || !editedPlan || !profilingResults) return;
    setStatus("writing");

    try {
      const res = await fetch(`/api/ingest/approve/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: editedPlan, profilingResults }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatus("error");
        setError(data.error || "Wiki generation failed");
        return;
      }
      setPagesWritten(data.pagesWritten);
      setStatus("complete");
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Network error");
    }
  }

  async function handleReject() {
    if (!jobId) return;
    await fetch(`/api/ingest/reject/${jobId}`, { method: "POST" });
    setStatus("idle");
    setEditedPlan(null);
    setProfilingResults(null);
    setJobId(null);
    setModifyPrompt("");
    setModifyStatus("idle");
    setModifyMessage("");
    setTargetKb("");
    setWikiName("");
  }

  async function handleModify() {
    if (!jobId || !editedPlan || !profilingResults || !modifyPrompt.trim()) return;
    setModifyStatus("loading");
    setModifyMessage("");

    try {
      const res = await fetch(`/api/ingest/modify/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPlan: editedPlan,
          profilingResults,
          modificationPrompt: modifyPrompt.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setModifyStatus("error");
        setModifyMessage(data.error || "Modification failed");
        return;
      }
      setEditedPlan(JSON.parse(JSON.stringify(data.plan)));
      setModifyStatus("success");
      setModifyMessage("Plan updated based on your prompt.");
      setModifyPrompt("");
    } catch (err: any) {
      setModifyStatus("error");
      setModifyMessage(err.message || "Network error");
    }
  }

  function updateIndexContent(content: string) {
    if (!editedPlan) return;
    setEditedPlan({ ...editedPlan, indexContent: content });
  }

  function updatePageTitle(index: number, title: string) {
    if (!editedPlan) return;
    const pages = [...editedPlan.proposedPages];
    pages[index] = { ...pages[index], title };
    setEditedPlan({ ...editedPlan, proposedPages: pages });
  }

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      {status === "idle" && (
        <div className="space-y-4">
          {existingKbs.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <label className="block text-sm font-medium mb-1">Target Wiki</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={targetKb}
                onChange={(e) => {
                  setTargetKb(e.target.value);
                  if (e.target.value) setWikiName("");
                }}
              >
                <option value="">Create new wiki</option>
                {existingKbs.map((kb) => (
                  <option key={kb.name} value={kb.name}>
                    {kb.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!targetKb && (
            <div className="bg-white rounded-lg shadow p-4">
              <label className="block text-sm font-medium mb-1">Wiki Name (optional)</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., Defense Exports 2024"
                value={wikiName}
                onChange={(e) => setWikiName(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to auto-generate a name from the filename.
              </p>
            </div>
          )}
          <div
            className={`bg-white rounded-lg shadow p-12 text-center border-2 border-dashed transition-colors ${
              dragActive ? "border-emerald-500 bg-emerald-50" : "border-gray-300"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <p className="text-gray-500 mb-4">
              Drag and drop a CSV or JSON file here, or click to browse.
            </p>
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Select File
            </label>
          </div>
        </div>
      )}

      {/* Status */}
      {status !== "idle" && status !== "awaiting_approval" && status !== "complete" && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            <span className="font-medium capitalize">{status.replace("_", " ")}...</span>
          </div>
          {error && <p className="text-red-600 mt-2">{error}</p>}
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-red-600 font-medium">Error: {error}</p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Plan Approval */}
      {status === "awaiting_approval" && editedPlan && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h2 className="text-xl font-bold">Proposed Wiki Plan</h2>

          {/* Index Content */}
          <div>
            <label className="block text-sm font-medium mb-1">index.md</label>
            <textarea
              className="w-full border rounded px-3 py-2 h-48 font-mono text-sm"
              value={editedPlan.indexContent}
              onChange={(e) => updateIndexContent(e.target.value)}
            />
          </div>

          {/* Proposed Pages */}
          <div>
            <h3 className="font-medium mb-2">Proposed Pages</h3>
            <div className="space-y-3">
              {editedPlan.proposedPages.map((page, i) => (
                <div key={i} className="border rounded p-3">
                  <div className="flex gap-2 mb-1">
                    <input
                      type="text"
                      className="flex-1 border rounded px-2 py-1 text-sm font-medium"
                      value={page.title}
                      onChange={(e) => updatePageTitle(i, e.target.value)}
                    />
                    <span className="text-xs text-gray-500 self-center">{page.path}</span>
                  </div>
                  <p className="text-sm text-gray-600">{page.rationale}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Linkage Hints */}
          {editedPlan.linkageHints.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Linkage Hints</h3>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {editedPlan.linkageHints.map((hint, i) => (
                  <li key={i}>{hint}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Modify with Prompt */}
          <div className="pt-4 border-t space-y-3">
            <label className="block text-sm font-medium">
              Modify Plan with Prompt
            </label>
            <textarea
              className="w-full border rounded px-3 py-2 h-24 resize-none"
              placeholder="e.g., Add a page for Danish companies only. Merge this into the 'defense-exports' knowledge base. Make the index more detailed."
              value={modifyPrompt}
              onChange={(e) => setModifyPrompt(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleModify}
                disabled={modifyStatus === "loading" || !modifyPrompt.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {modifyStatus === "loading" ? "Modifying..." : "Modify with Prompt"}
              </button>
              {modifyStatus === "success" && (
                <span className="text-sm text-green-600">{modifyMessage}</span>
              )}
              {modifyStatus === "error" && (
                <span className="text-sm text-red-600">{modifyMessage}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={handleApprove}
              className="px-6 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-colors"
            >
              Approve & Generate Wiki
            </button>
            <button
              onClick={handleReject}
              className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
            >
              Reject & Start Over
            </button>
          </div>
        </div>
      )}

      {/* Complete */}
      {status === "complete" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-green-700 mb-2">Ingestion Complete</h2>
          <p className="text-gray-600">
            {pagesWritten} wiki page(s) generated and written to disk.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800"
          >
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );
}
