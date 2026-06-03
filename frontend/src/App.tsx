import { Routes, Route, Navigate } from "react-router-dom";
import ConfigPage from "./pages/ConfigPage.js";
import IngestPage from "./pages/IngestPage.js";
import InvestigatePage from "./pages/InvestigatePage.js";
import NavBar from "./components/NavBar.js";

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/ingest" element={<IngestPage />} />
          <Route path="/investigate" element={<InvestigatePage />} />
          <Route path="*" element={<Navigate to="/config" replace />} />
        </Routes>
      </main>
      <footer className="p-4 text-center text-sm text-gray-500 border-t">
        Graver-AI Prototype — Sprint 2 Clients &amp; Configuration
      </footer>
    </div>
  );
}

export default App;
