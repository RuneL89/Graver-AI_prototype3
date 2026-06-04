import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SourceTableModal from "../components/SourceTableModal";

interface KBEntry {
  name: string;
  displayName: string;
  pages: string[];
}

export default function WikiViewerPage() {
  const [kbs, setKbs] = useState<KBEntry[]>([]);
  const [selectedKb, setSelectedKb] = useState<string>("");
  const [selectedPage, setSelectedPage] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [renameMap, setRenameMap] = useState<Record<string, string>>({});
  const [newPageName, setNewPageName] = useState("");
  const [newPageKb, setNewPageKb] = useState("");
  const [sourceModalTable, setSourceModalTable] = useState<string | null>(null);

  useEffect(() => {
    fetchKbs();
  }, []);

  async function fetchKbs() {
    try {
      const res = await fetch("/api/wiki");
      const data = await res.json();
      const kbList: Array<{ name: string; displayName: string }> = data.knowledgeBases || [];
      const entries: KBEntry[] = [];
      for (const kb of kbList) {
        const pagesRes = await fetch(`/api/wiki/${encodeURIComponent(kb.name)}`);
        const pagesData = await pagesRes.json();
        entries.push({ name: kb.name, displayName: kb.displayName, pages: pagesData.pages || [] });
      }
      setKbs(entries);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function loadPage(kbName: string, pagePath: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/wiki/${encodeURIComponent(kbName)}/${pagePath}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load page");
        return;
      }
      setContent(data.content);
      setSelectedKb(kbName);
      setSelectedPage(pagePath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function processWikilinks(markdown: string, kbName: string): string {
    // Convert [[page-path]] -> [page-path](/wiki/kbName/page-path)
    // Convert [[page-path|Display Text]] -> [Display Text](/wiki/kbName/page-path)
    return markdown.replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_match, path, display) => {
        const cleanPath = path.trim();
        const text = (display || cleanPath).trim();
        // If path has no extension, assume .md
        const linkPath = cleanPath.endsWith(".md") ? cleanPath : `${cleanPath}.md`;
        return `[${text}](/wiki/${kbName}/${linkPath})`;
      }
    );
  }

  function processSourceRefs(markdown: string): string {
    // Convert [source: table_name] -> [source: table_name](/source/table_name)
    return markdown.replace(
      /\[source:\s*([a-zA-Z0-9_]+)\]/g,
      (_match, tableName) => {
        return `[source: ${tableName}](/source/${tableName})`;
      }
    );
  }

  function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const href = e.currentTarget.getAttribute("href");
    if (!href) return;
    if (href.startsWith("/wiki/")) {
      e.preventDefault();
      const parts = href.replace("/wiki/", "").split("/");
      if (parts.length >= 2) {
        const kb = parts[0];
        const page = parts.slice(1).join("/");
        loadPage(kb, page);
      }
    } else if (href.startsWith("/source/")) {
      e.preventDefault();
      const tableName = href.replace("/source/", "");
      if (tableName) {
        setSourceModalTable(tableName);
      }
    }
  }

  async function handleDeletePage(kbName: string, pagePath: string) {
    if (!confirm(`Delete page "${pagePath}"?`)) return;
    try {
      await fetch(`/api/wiki/${encodeURIComponent(kbName)}/${pagePath}`, { method: "DELETE" });
      if (selectedKb === kbName && selectedPage === pagePath) {
        setContent("");
        setSelectedPage("");
      }
      await fetchKbs();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRenamePage(kbName: string, oldPath: string) {
    const newPath = renameMap[`${kbName}/${oldPath}`];
    if (!newPath || newPath === oldPath) return;
    try {
      await fetch(`/api/wiki/${encodeURIComponent(kbName)}/${oldPath}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPath: newPath.endsWith(".md") ? newPath : `${newPath}.md` }),
      });
      if (selectedKb === kbName && selectedPage === oldPath) {
        setSelectedPage(newPath.endsWith(".md") ? newPath : `${newPath}.md`);
      }
      setRenameMap((prev) => {
        const next = { ...prev };
        delete next[`${kbName}/${oldPath}`];
        return next;
      });
      await fetchKbs();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteKb(kbName: string) {
    if (!confirm(`Delete entire knowledge base "${kbName}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/wiki/${encodeURIComponent(kbName)}`, { method: "DELETE" });
      if (selectedKb === kbName) {
        setContent("");
        setSelectedKb("");
        setSelectedPage("");
      }
      await fetchKbs();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreatePage(kbName: string) {
    const name = newPageName.trim();
    if (!name) return;
    const pagePath = name.endsWith(".md") ? name : `${name}.md`;
    try {
      await fetch(`/api/wiki/${encodeURIComponent(kbName)}/${pagePath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `# ${name.replace(/\.md$/, "")}\n\n` }),
      });
      setNewPageName("");
      setNewPageKb("");
      await fetchKbs();
      await loadPage(kbName, pagePath);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Wiki Viewer</h1>
        <button
          onClick={() => setEditMode(!editMode)}
          className={`px-4 py-2 rounded transition-colors ${
            editMode
              ? "bg-slate-800 text-white hover:bg-slate-700"
              : "bg-gray-200 text-gray-800 hover:bg-gray-300"
          }`}
        >
          {editMode ? "Done Editing" : "Edit Mode"}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-72 shrink-0">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-medium mb-3">Knowledge Bases</h2>
            {kbs.length === 0 && (
              <p className="text-sm text-gray-500">No wikis yet. Ingest data to create one.</p>
            )}
            <div className="space-y-4">
              {kbs.map((kb) => (
                <div key={kb.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-semibold text-slate-800">{kb.displayName}</div>
                    {editMode && (
                      <button
                        onClick={() => handleDeleteKb(kb.name)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Delete KB
                      </button>
                    )}
                  </div>
                  <ul className="space-y-1">
                    {kb.pages.map((page) => (
                      <li key={page} className="flex items-center gap-1">
                        {editMode && renameMap[`${kb.name}/${page}`] !== undefined ? (
                          <div className="flex gap-1 w-full">
                            <input
                              type="text"
                              className="flex-1 border rounded px-1 py-0.5 text-xs"
                              value={renameMap[`${kb.name}/${page}`]}
                              onChange={(e) =>
                                setRenameMap((prev) => ({
                                  ...prev,
                                  [`${kb.name}/${page}`]: e.target.value,
                                }))
                              }
                              onBlur={() => handleRenamePage(kb.name, page)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenamePage(kb.name, page);
                              }}
                              autoFocus
                            />
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => loadPage(kb.name, page)}
                              className={`flex-1 text-sm text-left px-2 py-1 rounded transition-colors truncate ${
                                selectedKb === kb.name && selectedPage === page
                                  ? "bg-slate-200 font-medium"
                                  : "hover:bg-gray-100 text-gray-600"
                              }`}
                            >
                              {page.replace(/\.md$/, "")}
                            </button>
                            {editMode && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() =>
                                    setRenameMap((prev) => ({
                                      ...prev,
                                      [`${kb.name}/${page}`]: page.replace(/\.md$/, ""),
                                    }))
                                  }
                                  className="text-xs text-blue-600 hover:text-blue-800 px-1"
                                  title="Rename"
                                >
                                  R
                                </button>
                                <button
                                  onClick={() => handleDeletePage(kb.name, page)}
                                  className="text-xs text-red-600 hover:text-red-800 px-1"
                                  title="Delete"
                                >
                                  ×
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  {editMode && (
                    <div className="mt-2 flex gap-1">
                      {newPageKb === kb.name ? (
                        <div className="flex gap-1 w-full">
                          <input
                            type="text"
                            className="flex-1 border rounded px-2 py-1 text-xs"
                            placeholder="page-name.md"
                            value={newPageName}
                            onChange={(e) => setNewPageName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCreatePage(kb.name);
                              if (e.key === "Escape") setNewPageKb("");
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleCreatePage(kb.name)}
                            className="text-xs bg-emerald-600 text-white px-2 py-1 rounded"
                          >
                            Add
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setNewPageKb(kb.name)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          + New Page
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-lg shadow p-6 min-h-[500px]">
            {loading && <p className="text-gray-500">Loading...</p>}
            {error && <p className="text-red-600">{error}</p>}
            {!loading && !error && !content && (
              <p className="text-gray-500">Select a page from the sidebar to view it.</p>
            )}
            {!loading && !error && content && selectedKb && (
              <article className="prose prose-slate max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ node: _node, children, href, ...props }) => {
                      if (href?.startsWith("/wiki/")) {
                        return (
                          <a
                            href={href}
                            onClick={handleLinkClick}
                            className="text-blue-600 hover:underline cursor-pointer"
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      }
                      if (href?.startsWith("/source/")) {
                        return (
                          <a
                            href={href}
                            onClick={handleLinkClick}
                            className="text-emerald-600 hover:underline cursor-pointer font-medium"
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      }
                      return <a href={href} {...props}>{children}</a>;
                    },
                  }}
                >
                  {processSourceRefs(processWikilinks(content, selectedKb))}
                </ReactMarkdown>
              </article>
            )}
          </div>
        </main>
      </div>
      {sourceModalTable && (
        <SourceTableModal
          tableName={sourceModalTable}
          onClose={() => setSourceModalTable(null)}
        />
      )}
    </div>
  );
}
