import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Dossier } from "@graver-ai/shared";

interface Props {
  dossier: Dossier;
}

function ConfidenceBadge({ confidence }: { confidence: "HIGH" | "MEDIUM" | "LOW" }) {
  const colors = {
    HIGH: "bg-green-100 text-green-700 border-green-200",
    MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
    LOW: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[confidence]}`}>
      {confidence}
    </span>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="font-semibold text-slate-800">{title}</span>
        <span className="text-slate-500 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

export default function DossierViewer({ dossier }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">Investigation Dossier</h3>
        <ConfidenceBadge confidence={dossier.overallConfidence} />
      </div>

      {/* Executive Summary — always expanded */}
      <CollapsibleSection title="Executive Summary" defaultOpen={true}>
        <div className="prose prose-slate max-w-none text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {dossier.executiveSummary}
          </ReactMarkdown>
        </div>
      </CollapsibleSection>

      {/* Findings by Sub-Claim */}
      <CollapsibleSection title={`Findings by Sub-Claim (${dossier.findings.length})`}>
        <div className="space-y-3">
          {dossier.findings.map((f) => (
            <div key={f.subClaimId} className="border rounded p-3 bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-slate-500">{f.subClaimId}</span>
                <ConfidenceBadge confidence={f.confidence} />
              </div>
              {f.claimText && (
                <p className="text-sm font-medium text-slate-700 mb-2">{f.claimText}</p>
              )}
              <div className="prose prose-slate max-w-none text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{f.narrative}</ReactMarkdown>
              </div>
              {f.contradictions.length > 0 && (
                <div className="mt-2 text-sm">
                  <span className="font-medium text-red-600">Contradictions:</span>
                  <ul className="list-disc list-inside text-red-700 mt-1">
                    {f.contradictions.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Cross-Source Connections */}
      <CollapsibleSection title={`Cross-Source Connections (${dossier.connections.length})`}>
        <div className="space-y-2">
          {dossier.connections.map((c, i) => (
            <div key={i} className="border rounded p-3 bg-gray-50">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{c.entityIdentifier}</span>
                <ConfidenceBadge confidence={c.confidence} />
              </div>
              <p className="text-sm text-gray-700">{c.notes}</p>
              <p className="text-xs text-gray-500 mt-1">
                Sources: {c.sources.join(", ")}
              </p>
            </div>
          ))}
          {dossier.connections.length === 0 && (
            <p className="text-sm text-gray-500 italic">No connections identified.</p>
          )}
        </div>
      </CollapsibleSection>

      {/* Evidence Gaps */}
      <CollapsibleSection title={`Evidence Gaps (${dossier.gaps.length})`}>
        <div className="space-y-2">
          {dossier.gaps.map((g, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-gray-700">{g}</span>
            </div>
          ))}
          {dossier.gaps.length === 0 && (
            <p className="text-sm text-gray-500 italic">No gaps identified.</p>
          )}
        </div>
      </CollapsibleSection>

      {/* Source Attribution */}
      <CollapsibleSection title={`Source Attribution (${dossier.sourceAttribution.length})`}>
        <div className="space-y-2">
          {dossier.sourceAttribution.map((a, i) => (
            <div key={i} className="text-sm border rounded p-2 bg-gray-50">
              <p className="text-gray-800">{a.claim}</p>
              <p className="text-xs text-gray-500 mt-1">
                <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${
                  a.sourceType === "sqlite" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                }`}>
                  {a.sourceType}
                </span>
                {" "}
                <span className="font-mono text-gray-600">{a.sourceDetail}</span>
              </p>
            </div>
          ))}
          {dossier.sourceAttribution.length === 0 && (
            <p className="text-sm text-gray-500 italic">No source attribution recorded.</p>
          )}
        </div>
      </CollapsibleSection>

      {/* Suggested Next Steps */}
      <CollapsibleSection title={`Suggested Next Steps (${dossier.suggestedNextSteps.length})`}>
        <div className="space-y-2">
          {dossier.suggestedNextSteps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-slate-500 mt-0.5">→</span>
              <span className="text-gray-700">{s}</span>
            </div>
          ))}
          {dossier.suggestedNextSteps.length === 0 && (
            <p className="text-sm text-gray-500 italic">No next steps suggested.</p>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
