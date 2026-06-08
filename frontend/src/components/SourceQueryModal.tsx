import { X, Database, AlertCircle } from "lucide-react";

interface Props {
  query: string;
  results: unknown[];
  onClose: () => void;
}

export default function SourceQueryModal({ query, results, onClose }: Props) {
  const columns =
    results.length > 0 && typeof results[0] === "object" && results[0] !== null
      ? Object.keys(results[0] as Record<string, unknown>)
      : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[95vw] h-[90vh] md:w-[60vw] md:h-[80vh] relative flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-800">Source Query</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Query block */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              SQL Query
            </h3>
            <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded overflow-x-auto whitespace-pre-wrap">
              {query}
            </pre>
          </div>

          {/* Results table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Results ({results.length} row{results.length === 1 ? "" : "s"})
            </h3>

            {results.length === 0 ? (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4" />
                No results returned by this query.
              </div>
            ) : columns.length === 0 ? (
              <div className="text-sm text-gray-500">
                Results are not in tabular format.
              </div>
            ) : (
              <div className="border rounded overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2 text-left font-semibold text-slate-700 whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {results.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {columns.map((col) => {
                            const val = (row as Record<string, unknown>)[col];
                            return (
                              <td
                                key={col}
                                className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate"
                                title={
                                  typeof val === "string"
                                    ? val
                                    : JSON.stringify(val)
                                }
                              >
                                {typeof val === "object"
                                  ? JSON.stringify(val)
                                  : String(val ?? "")}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
