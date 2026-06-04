import { useState, useMemo } from "react";
import {
  Hammer,
  Compass,
  Zap,
  Search,
  Link,
  Puzzle,
  ClipboardCheck,
  RefreshCw,
  Folder,
  FileText,
} from "lucide-react";

interface StreamEvent {
  type: "stage_start" | "stage_complete" | "reasoning" | "error" | "query_executed";
  stage: string;
  timestamp: string;
  payload?: Record<string, unknown>;
  chunk?: string;
}

interface Props {
  events: StreamEvent[];
  maxRounds?: number;
}

const stageOrder = [
  "decomposer",
  "navigator",
  "generator",
  "executor",
  "resolver",
  "synthesizer",
  "auditor",
  "assembler",
  "writeback",
];

const stageLabels: Record<string, string> = {
  decomposer: "Decompose",
  navigator: "Navigate KBs",
  generator: "Generate Queries",
  executor: "Execute Queries",
  resolver: "Resolve Entities",
  synthesizer: "Synthesize",
  auditor: "Audit Gaps",
  incrementRound: "Next Round",
  assembler: "Assemble Dossier",
  writeback: "Write to Wiki",
};

const stageIcons: Record<string, React.FC<{ className?: string }>> = {
  decomposer: Hammer,
  navigator: Compass,
  generator: Zap,
  executor: Search,
  resolver: Link,
  synthesizer: Puzzle,
  auditor: ClipboardCheck,
  incrementRound: RefreshCw,
  assembler: Folder,
  writeback: FileText,
};

export default function StageProgress({ events, maxRounds = 5 }: Props) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const { stageStatuses, currentRound, stageOutputs } = useMemo(() => {
    const statuses: Record<string, "pending" | "active" | "completed" | "error"> = {};
    const outputs: Record<string, Record<string, unknown>[]> = {};
    let round = 1;

    for (const stage of stageOrder) {
      statuses[stage] = "pending";
      outputs[stage] = [];
    }
    statuses["incrementRound"] = "pending";
    outputs["incrementRound"] = [];

    for (const event of events) {
      if (event.type === "stage_start") {
        statuses[event.stage] = "active";
        if (event.payload?.round && typeof event.payload.round === "number") {
          round = event.payload.round;
        }
      }
      if (event.type === "stage_complete") {
        statuses[event.stage] = "completed";
        if (event.payload) {
          outputs[event.stage] = [...(outputs[event.stage] || []), event.payload];
        }
        if (event.payload?.newRound && typeof event.payload.newRound === "number") {
          round = event.payload.newRound;
        }
      }
      if (event.type === "error" && event.stage !== "investigation") {
        statuses[event.stage] = "error";
      }
    }

    return { stageStatuses: statuses, currentRound: round, stageOutputs: outputs };
  }, [events]);

  const activeStage = useMemo(() => {
    for (const stage of stageOrder) {
      if (stageStatuses[stage] === "active") return stage;
    }
    if (stageStatuses["incrementRound"] === "active") return "incrementRound";
    return null;
  }, [stageStatuses]);

  const hasLoop = events.some(
    (e) => e.type === "stage_complete" && e.stage === "incrementRound"
  );

  function toggleStage(stage: string) {
    setExpandedStage((prev) => (prev === stage ? null : stage));
  }

  function stageClass(status: string) {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "active":
        return "bg-blue-100 text-blue-800 border-blue-300 ring-2 ring-blue-200 animate-pulse";
      case "error":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-500 border-gray-200";
    }
  }

  function dotClass(status: string) {
    switch (status) {
      case "completed":
        return "bg-emerald-500";
      case "active":
        return "bg-blue-500 animate-pulse";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-300";
    }
  }

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Pipeline Progress</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Round</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100">
            {currentRound} / {maxRounds}
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* Pipeline steps */}
        <div className="flex flex-wrap items-center gap-1">
          {stageOrder.map((stage, index) => {
            const status = stageStatuses[stage] || "pending";
            const isClickable = status === "completed" || status === "error";
            const StageIcon = stageIcons[stage];
            return (
              <div key={stage} className="flex items-center">
                <button
                  onClick={() => isClickable && toggleStage(stage)}
                  disabled={!isClickable}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${stageClass(
                    status
                  )} ${isClickable ? "cursor-pointer hover:shadow-sm" : "cursor-default"}`}
                  title={stageLabels[stage]}
                >
                  {StageIcon && <StageIcon className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{stageLabels[stage]}</span>
                </button>
                {index < stageOrder.length - 1 && (
                  <div className="w-3 h-px bg-gray-300 mx-0.5 hidden sm:block" />
                )}
              </div>
            );
          })}
        </div>

        {/* Loop indicator */}
        {hasLoop && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>Looping back to navigator for next round</span>
          </div>
        )}

        {/* Active stage indicator */}
        {activeStage && (
          <div className="mt-3 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${dotClass("active")}`} />
            <span className="text-sm font-medium text-blue-700">
              {stageLabels[activeStage] || activeStage} is running...
            </span>
          </div>
        )}

        {/* Expanded stage output */}
        {expandedStage && stageOutputs[expandedStage]?.length > 0 && (
          <div className="mt-3 border rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">
                {stageLabels[expandedStage]} Output
              </h4>
              <button
                onClick={() => setExpandedStage(null)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stageOutputs[expandedStage].map((payload, i) => (
                <pre
                  key={i}
                  className="text-xs bg-white border rounded p-2 overflow-x-auto font-mono text-gray-700"
                >
                  {JSON.stringify(payload, null, 2)}
                </pre>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
