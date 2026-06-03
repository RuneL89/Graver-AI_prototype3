export default function InvestigatePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Investigate</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium mb-2">
          Enter your investigative tip
        </label>
        <textarea
          className="w-full border rounded px-3 py-2 h-32 resize-none"
          placeholder="e.g., Danish military equipment exported to Israel and used in Gaza..."
        />
        <div className="mt-4 flex justify-end">
          <button className="px-6 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors">
            Start Investigation
          </button>
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-500">
        This panel will show the real-time agent stream and final dossier in
        future sprints.
      </p>
    </div>
  );
}
