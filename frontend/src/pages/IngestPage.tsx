import IngestionPanel from "../components/IngestionPanel.js";
import AgentInventory, { ingestionAgents } from "../components/AgentInventory";

export default function IngestPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Ingest Data</h1>
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          <IngestionPanel />
        </div>
        <div className="w-80 shrink-0 hidden lg:block">
          <AgentInventory agents={ingestionAgents} />
        </div>
      </div>
    </div>
  );
}
