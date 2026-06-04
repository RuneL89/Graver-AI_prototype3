import { useState, useEffect, useCallback } from "react";

interface Column {
  name: string;
  type: string;
}

interface SourceData {
  tableName: string;
  columns: Column[];
  rows: unknown[][];
  totalCount: number;
  limit: number;
  offset: number;
}

interface SourceTableModalProps {
  tableName: string;
  onClose: () => void;
}

function isJsonString(str: string): boolean {
  const trimmed = str.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  const str = String(value);
  if (isJsonString(str)) {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  }
  return str;
}

function isJsonCell(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "object") return true;
  const str = String(value);
  return isJsonString(str);
}

export default function SourceTableModal({ tableName, onClose }: SourceTableModalProps) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const fetchData = useCallback(
    async (fetchOffset: number, append: boolean) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/source/${encodeURIComponent(tableName)}?limit=${limit}&offset=${fetchOffset}`
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to load data");
          return;
        }
        const sourceData = data as SourceData;
        if (append) {
          setRows((prev) => [...prev, ...sourceData.rows]);
        } else {
          setColumns(sourceData.columns);
          setRows(sourceData.rows);
        }
        setTotalCount(sourceData.totalCount);
        setOffset(fetchOffset + sourceData.rows.length);
      } catch (err: any) {
        setError(err.message || "Network error");
      } finally {
        setLoading(false);
      }
    },
    [tableName]
  );

  useEffect(() => {
    fetchData(0, false);
  }, [fetchData]);

  const handleLoadMore = () => {
    if (offset < totalCount && !loading) {
      fetchData(offset, true);
    }
  };

  const handleShowAll = () => {
    if (offset < totalCount && !loading) {
      const remaining = totalCount - offset;
      const fetchLimit = Math.min(remaining, 1000);
      setLoading(true);
      setError("");
      fetch(`/api/source/${encodeURIComponent(tableName)}?limit=${fetchLimit}&offset=${offset}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.rows) {
            setError(data.error || "Failed to load data");
            return;
          }
          setRows((prev) => [...prev, ...data.rows]);
          setOffset(offset + data.rows.length);
        })
        .catch((err: any) => setError(err.message || "Network error"))
        .finally(() => setLoading(false));
    }
  };

  const allLoaded = rows.length >= totalCount;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[65vw] h-[65vh] bg-white rounded-lg shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Source: {tableName}
            </h2>
            <p className="text-xs text-slate-500">
              {rows.length.toLocaleString()} of {totalCount.toLocaleString()} rows shown
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {error && (
            <div className="p-4 text-red-600 text-sm">{error}</div>
          )}
          {!error && columns.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.name}
                      className="px-3 py-2 text-left font-semibold text-slate-700 border-b whitespace-nowrap"
                    >
                      {col.name}
                      <span className="text-xs text-slate-400 ml-1 font-normal">
                        {col.type}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    {row.map((cell, cellIdx) => {
                      const formatted = formatCell(cell);
                      const json = isJsonCell(cell);
                      return (
                        <td
                          key={cellIdx}
                          className={
                            json
                              ? "px-3 py-2 border-b text-slate-700 min-w-[300px]"
                              : "px-3 py-2 border-b text-slate-700 max-w-[200px] truncate"
                          }
                          title={json ? undefined : formatted}
                        >
                          {json ? (
                            <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap break-all">
                              {formatted}
                            </pre>
                          ) : (
                            formatted
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!error && columns.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-500">No data in this table.</div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
          <div className="text-xs text-slate-500">
            {loading ? "Loading..." : allLoaded ? "All rows loaded" : ""}
          </div>
          <div className="flex gap-2">
            {!allLoaded && (
              <>
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm bg-white border rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Load 100 more
                </button>
                <button
                  onClick={handleShowAll}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  Show all remaining
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
