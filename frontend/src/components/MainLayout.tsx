import { Link, useLocation } from "react-router-dom";
import {
  Settings,
  FolderOpen,
  Search,
  BookOpen,
} from "lucide-react";

const navItems = [
  { path: "/investigate", label: "Investigate", Icon: Search },
  { path: "/ingest", label: "Ingest Data", Icon: FolderOpen },
  { path: "/wiki", label: "Wiki", Icon: BookOpen },
  { path: "/config", label: "Configuration", Icon: Settings },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top navigation */}
      <header className="bg-slate-900 text-white px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-tight">
            Graver-AI
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-slate-700 text-white"
                      : "text-gray-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <item.Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t px-6 py-3 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span>Graver-AI Prototype</span>
          <span>v0.6.0</span>
        </div>
      </footer>
    </div>
  );
}
