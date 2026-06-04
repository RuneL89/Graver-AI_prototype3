import { useState, useEffect, useRef } from "react";

interface StreamEvent {
  type: "stage_start" | "stage_complete" | "reasoning" | "error";
  stage: string;
  timestamp: string;
  payload?: Record<string, unknown>;
  chunk?: string;
}

interface Props {
  investigationId: string;
  onComplete?: () => void;
}

export default function AgentStream({ investigationId, onComplete }: Props) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

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

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Agent Stream</h3>
        <div className="flex items-center gap-2">
          {done ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Complete</span>
          ) : connected ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 animate-pulse">Live</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Connecting...</span>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
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

          if (event.type === "stage_start") {
            return (
              <div key={i} className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded border ${colorClass}`}>
                  {stageLabels[event.stage] || event.stage}
                </span>
                <span className="text-xs text-gray-500">started</span>
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
  );
}
