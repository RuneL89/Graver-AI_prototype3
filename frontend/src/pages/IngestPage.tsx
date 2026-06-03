export default function IngestPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Ingest Data</h1>
      <div className="bg-white rounded-lg shadow p-12 text-center border-2 border-dashed border-gray-300">
        <p className="text-gray-500 mb-4">
          Drag and drop a CSV or JSON file here, or click to browse.
        </p>
        <button className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors">
          Select File
        </button>
      </div>
      <p className="mt-4 text-sm text-gray-500">
        This panel will show upload progress, statistical profiling results, and
        wiki plan approval in future sprints.
      </p>
    </div>
  );
}
