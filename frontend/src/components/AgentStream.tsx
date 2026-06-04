import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Globe, Database } from "lucide-react";
import StageProgress from "./StageProgress.js";

interface StreamEvent {
  type: "stage_start" | "stage_complete" | "reasoning" | "error" | "query_executed";
  stage: string;
  timestamp: string;
  payload?: Record<string, unknown>;
  chunk?: string;
}

interface Props {
  investigationId: string;
  onComplete?: () => void;
  maxRounds?: number;
}

export default function AgentStream({ investigationId, onComplete, maxRounds = 5 }: Props) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<StreamEvent[]>([]);

  // Keep ref in sync for scroll effect
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    const es = new EventSource(`/api/investigate/${investigationId}/stream`);

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      if (!e.data || e.data.startsWith(":")) return; // heartbeat
      try {
        const event: StreamEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);

        if (event.type === "stage_complete" && event.stage === "investigation") {
          setDone(true);
          es.close();
          onComplete?.();
        }
        if (event.type === "error" && event.stage === "investigation") {
          setDone(true);
          es.close();
          onComplete?.();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [investigationId, onComplete]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(isNearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  const stageColors: Record<string, string> = {
    decomposer: "bg-blue-100 text-blue-800 border-blue-200",
    navigator: "bg-purple-100 text-purple-800 border-purple-200",
    generator: "bg-amber-100 text-amber-800 border-amber-200",
    executor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    resolver: "bg-pink-100 text-pink-800 border-pink-200",
    synthesizer: "bg-cyan-100 text-cyan-800 border-cyan-200",
    auditor: "bg-orange-100 text-orange-800 border-orange-200",
    incrementRound: "bg-gray-100 text-gray-800 border-gray-200",
    assembler: "bg-indigo-100 text-indigo-800 border-indigo-200",
    writeback: "bg-teal-100 text-teal-800 border-teal-200",
    investigation: "bg-slate-100 text-slate-800 border-slate-200",
  };

  const stageLabels: Record<string, string> = {
    decomposer: "Tip Decomposer",
    navigator: "KB Navigator",
    generator: "Query Generator",
    executor: "Query Executor",
    resolver: "Entity Resolver",
    synthesizer: "Evidence Synthesizer",
    auditor: "Gap Auditor",
    incrementRound: "Round Increment",
    assembler: "Dossier Assembler",
    writeback: "Wiki Writeback",
    investigation: "Investigation",
  };

  // Track active stage
  const activeStage = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].type === "stage_start") {
        // Only return if there's no matching complete yet
        const stage = events[i].stage;
        let hasComplete = false;
        for (let j = i + 1; j < events.length; j++) {
          if (events[j].stage === stage && events[j].type === "stage_complete") {
            hasComplete = true;
            break;
          }
        }
        if (!hasComplete) return stage;
      }
    }
    return null;
  }, [events]);

  // Track KB assignments
  const kbAssignments = useMemo(() => {
    const assignments: Array<{ kbName: string; subClaimId: string; sourceType: string }> = [];
    for (const event of events) {
      if (event.type === "stage_complete" && event.stage === "navigator" && event.payload?.assignments) {
        const arr = event.payload.assignments as Array<{ kbName: string; subClaimId: string; sourceType: string }>;
        assignments.push(...arr);
      }
    }
    return assignments;
  }, [events]);

  return (
    <div className="space-y-4">
      <StageProgress events={events} maxRounds={maxRounds} />

      <div className="bg-white rounded-lg shadow border">
        <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Agent Stream</h3>
            {activeStage && (
              <span className={`text-xs px-2 py-0.5 rounded border ${stageColors[activeStage] || "bg-gray-100 text-gray-800 border-gray-200"}`}>
                {stageLabels[activeStage] || activeStage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!autoScroll && !done && (
              <button
                onClick={scrollToBottom}
                className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                Resume scroll ↓
              </button>
            )}
            {done ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Complete</span>
            ) : connected ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 animate-pulse">Live</span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Connecting...</span>
            )}
          </div>
        </div>

        {/* KB assignments summary */}
        {kbAssignments.length > 0 && (
          <div className="px-4 py-2 border-b bg-gray-50 flex flex-wrap gap-2">
            {kbAssignments.map((a, i) => (
              <span
                key={i}
                className={`text-xs px-2 py-0.5 rounded border ${
                  a.sourceType === "exa"
                    ? "bg-sky-50 text-sky-700 border-sky-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
                title={`Sub-claim: ${a.subClaimId}`}
              >
                {a.sourceType === "exa" ? <Globe className="w-3 h-3 inline" /> : <Database className="w-3 h-3 inline" />} {a.kbName}
              </span>
            ))}
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-96 overflow-y-auto px-4 py-3 space-y-2 font-mono text-sm"
        >
          {events.length === 0 && (
            <p className="text-gray-400 italic">Waiting for agent events...</p>
          )}

          {events.map((event, i) => {
            const colorClass = stageColors[event.stage] || "bg-gray-100 text-gray-800 border-gray-200";

            if (event.type === "reasoning") {
              return (
                <div key={i} className="pl-4 border-l-2 border-gray-200 text-gray-700 whitespace-pre-wrap">
                  {event.chunk}
                </div>
              );
            }

            if (event.type === "query_executed") {
              const p = event.payload || {};
              const sourceType = p.sourceType as string;
              const query = p.query as string;
              const resultCount = p.resultCount as number;
              const durationMs = p.durationMs as number | undefined;
              return (
                <div key={i} className="flex items-center gap-2 pl-4 border-l-2 border-emerald-200">
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                    sourceType === "exa"
                      ? "bg-sky-50 text-sky-700 border-sky-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}>
                    {sourceType === "exa" ? <><Globe className="w-3 h-3 inline mr-0.5" /> Exa</> : <><Database className="w-3 h-3 inline mr-0.5" /> SQLite</>}
                  </span>
                  <span className="text-xs text-gray-600 truncate flex-1" title={query}>
                    {query.length > 60 ? query.slice(0, 60) + "..." : query}
                  </span>
                  <span className="text-xs text-gray-500">
                    {resultCount} result{resultCount !== 1 ? "s" : ""}
                  </span>
                  {durationMs !== undefined && (
                    <span className="text-xs text-gray-400">{durationMs}ms</span>
                  )}
                </div>
              );
            }

            if (event.type === "stage_start") {
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded border ${colorClass}`}>
                    {stageLabels[event.stage] || event.stage}
                  </span>
                  <span className="text-xs text-gray-500">started</span>
                  {typeof event.payload?.round === "number" && (
                    <span className="text-xs text-gray-400">round {event.payload.round}</span>
                  )}
                </div>
              );
            }

            if (event.type === "stage_complete") {
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded border ${colorClass}`}>
                    {stageLabels[event.stage] || event.stage}
                  </span>
                  <span className="text-xs text-gray-500">completed</span>
                  {event.payload && (
                    <span className="text-xs text-gray-400">
                      {JSON.stringify(event.payload).slice(0, 120)}
                    </span>
                  )}
                </div>
              );
            }

            if (event.type === "error") {
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded border bg-red-100 text-red-800 border-red-200">
                    Error
                  </span>
                  <span className="text-xs text-red-600">
                    {event.payload?.message as string || "Unknown error"}
                  </span>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}


