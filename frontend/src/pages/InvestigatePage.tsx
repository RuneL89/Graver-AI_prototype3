import InvestigationPanel from "../components/InvestigationPanel";
import AgentInventory from "../components/AgentInventory";

export default function InvestigatePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Investigate</h1>
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          <InvestigationPanel />
        </div>
        <div className="w-80 shrink-0 hidden lg:block">
          <AgentInventory />
        </div>
      </div>
    </div>
  );
}
