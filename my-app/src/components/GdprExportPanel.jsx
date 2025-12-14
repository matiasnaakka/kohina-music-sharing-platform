import { useGdprExport } from '../hooks/useGdprExport'

export default function GdprExportPanel({ session }) {
  const { loading, error, jsonResult, downloadInfo, runExport, downloadJson } = useGdprExport(session)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-lg font-semibold">Export my data</h4>
          <p className="text-sm text-gray-400">
            Downloads your export file (or shows JSON if the function returns JSON).
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={runExport}
            disabled={loading}
            className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-sm font-semibold"
          >
            {loading ? 'Exporting…' : 'Download export'}
          </button>

          <button
            type="button"
            onClick={downloadJson}
            disabled={!jsonResult}
            className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-sm"
            title="Enabled only if the function returns JSON"
          >
            Download JSON
          </button>
        </div>
      </div>

      {error && <div className="mt-3 text-sm text-red-400">{error}</div>}
      {downloadInfo && <div className="mt-3 text-sm text-green-300">{downloadInfo}</div>}

      {!!jsonResult && (
        <div className="mt-3 space-y-3">
          {Array.isArray(jsonResult?.export?.files) && jsonResult.export.files.length > 0 && (
            <div>
              <div className="text-sm font-semibold mb-2">Files</div>
              <ul className="space-y-1 text-sm">
                {jsonResult.export.files.map((f, i) => (
                  <li key={f?.url || i} className="truncate">
                    <a href={f.url} target="_blank" rel="noreferrer" className="text-teal-300 hover:underline">
                      {f.name || f.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details className="bg-gray-950/40 border border-gray-800 rounded p-3">
            <summary className="cursor-pointer text-sm text-gray-300">View raw JSON</summary>
            <pre className="mt-2 text-xs text-gray-300 overflow-x-auto">{JSON.stringify(jsonResult, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  )
}
