import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { path: "/config", label: "Configuration", icon: "⚙️" },
  { path: "/ingest", label: "Ingest Data", icon: "📁" },
  { path: "/investigate", label: "Investigate", icon: "🔍" },
  { path: "/wiki", label: "Wiki", icon: "📖" },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"online" | "offline" | "checking">("checking");
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    async function checkBackend() {
      try {
        const res = await fetch("/api/config", { method: "GET" });
        if (mounted) setBackendStatus(res.ok ? "online" : "offline");
      } catch {
        if (mounted) setBackendStatus("offline");
      }
    }
    checkBackend();
    const interval = setInterval(checkBackend, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const statusDot =
    backendStatus === "online"
      ? "bg-emerald-500"
      : backendStatus === "offline"
      ? "bg-red-500"
      : "bg-amber-400 animate-pulse";

  const statusText =
    backendStatus === "online"
      ? "Online"
      : backendStatus === "offline"
      ? "Offline"
      : "Checking...";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-slate-800 rounded transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link to="/" className="text-lg font-bold tracking-tight">
            Graver-AI
          </Link>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${statusDot}`} />
          <span className="text-gray-300 hidden sm:inline">{statusText}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-56 bg-white border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto pt-14 lg:pt-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-slate-100 text-slate-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
            <p className="text-xs text-gray-400">
              Graver-AI Prototype
              <br />
              Sprint 6 — Real-Time Streaming
            </p>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Status bar */}
      <footer className="bg-white border-t px-4 py-2 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            Backend {statusText}
          </span>
        </div>
        <div className="hidden sm:block">v0.6.0 — Streaming & UI</div>
      </footer>
    </div>
  );
}
