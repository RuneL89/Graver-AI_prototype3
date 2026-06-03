import { Link, useLocation } from "react-router-dom";

const tabs = [
  { path: "/config", label: "Configuration" },
  { path: "/ingest", label: "Ingest Data" },
  { path: "/investigate", label: "Investigate" },
];

export default function NavBar() {
  const location = useLocation();

  return (
    <nav className="bg-slate-900 text-white px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight">
          Graver-AI
        </Link>
        <ul className="flex gap-4">
          {tabs.map((tab) => {
            const active = location.pathname === tab.path;
            return (
              <li key={tab.path}>
                <Link
                  to={tab.path}
                  className={`px-3 py-2 rounded transition-colors ${
                    active
                      ? "bg-slate-700 font-medium"
                      : "hover:bg-slate-800"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
