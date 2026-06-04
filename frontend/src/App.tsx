import { Routes, Route, Navigate } from "react-router-dom";
import ConfigPage from "./pages/ConfigPage.js";
import IngestPage from "./pages/IngestPage.js";
import InvestigatePage from "./pages/InvestigatePage.js";
import WikiViewerPage from "./pages/WikiPage.js";
import MainLayout from "./components/MainLayout.js";

function App() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/ingest" element={<IngestPage />} />
        <Route path="/investigate" element={<InvestigatePage />} />
        <Route path="/wiki" element={<WikiViewerPage />} />
        <Route path="*" element={<Navigate to="/config" replace />} />
      </Routes>
    </MainLayout>
  );
}

export default App;
