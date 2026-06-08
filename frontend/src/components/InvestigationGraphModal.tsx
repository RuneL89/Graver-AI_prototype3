import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { Dossier, EvidenceBundle } from "@graver-ai/shared";
import KnowledgeGraph from "./KnowledgeGraph.js";
import SourceQueryModal from "./SourceQueryModal.js";

interface Props {
  investigationId?: string;
  dossier?: Dossier;
  rawEvidence?: EvidenceBundle[];
  onClose: () => void;
}

interface FetchState {
  loading: boolean;
  error: string;
  dossier: Dossier | null;
  tip: string;
  rawEvidence: EvidenceBundle[] | null;
}

interface SelectedSource {
  query: string;
  results: unknown[];
}

export default function InvestigationGraphModal({
  investigationId,
  dossier: directDossier,
  rawEvidence: directRawEvidence,
  onClose,
}: Props) {
  const [state, setState] = useState<FetchState>({
    loading: !directDossier,
    error: "",
    dossier: directDossier ?? null,
    tip: "",
    rawEvidence: directRawEvidence ?? null,
  });
  const [selectedSource, setSelectedSource] = useState<SelectedSource | null>(null);

  useEffect(() => {
    if (directDossier) return;
    let cancelled = false;
    async function fetchInvestigation() {
      try {
        const res = await fetch(`/api/investigations/${encodeURIComponent(investigationId!)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to load investigation (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) {
          setState({
            loading: false,
            error: "",
            dossier: data.dossier,
            tip: data.tip || "",
            rawEvidence: data.rawEvidence || null,
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setState({ loading: false, error: err.message, dossier: null, tip: "", rawEvidence: null });
        }
      }
    }
    fetchInvestigation();
    return () => {
      cancelled = true;
    };
  }, [investigationId, directDossier]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[95vw] h-[90vh] md:w-[80vw] md:h-[80vh] relative flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-slate-800 truncate">
            Knowledge Graph — {investigationId}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 relative">
          {state.loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm">Loading investigation graph…</p>
            </div>
          )}
          {state.error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-600 px-6 text-center">
              <p className="text-sm font-medium">Failed to load graph</p>
              <p className="text-xs mt-1 text-red-500">{state.error}</p>
            </div>
          )}
          {state.dossier && (
            <KnowledgeGraph
              dossier={state.dossier}
              tip={state.tip}
              rawEvidence={(directRawEvidence ?? state.rawEvidence) || undefined}
              onSourceClick={(source) => {
                if (source.sourceType === "sqlite") {
                  setSelectedSource({ query: source.query, results: source.results });
                }
              }}
            />
          )}
          {selectedSource && (
            <SourceQueryModal
              query={selectedSource.query}
              results={selectedSource.results}
              onClose={() => setSelectedSource(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
