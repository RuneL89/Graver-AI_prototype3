import { useState } from "react";

interface Props {
  stage: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

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

export default function ErrorDisplay({ stage, message, onRetry, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-red-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-red-800">Error in {stageLabels[stage] || stage}</h4>
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
              {stage}
            </span>
          </div>
          <p className="text-sm text-red-700 mt-1">{message}</p>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.051M20.418 9c-.775-4.233-4.49-7.5-8.918-7.5a9 9 0 00-9 9 9 9 0 009 9c4.36 0 7.978-3.077 8.814-7.177" />
                </svg>
                Retry from failed stage
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded hover:bg-red-200 transition-colors"
            >
              {expanded ? "Hide Details" : "Show Details"}
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>

          {expanded && (
            <div className="mt-3 p-3 bg-white border border-red-100 rounded text-xs font-mono text-red-900 overflow-x-auto">
              <p className="font-semibold mb-1">Stage: {stage}</p>
              <p className="whitespace-pre-wrap">{message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
