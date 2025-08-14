import React from 'react';
import { searchDatasets, CkanDataset, CkanResource } from '../../services/ckan';

interface Props {
  onPick: (res: CkanResource) => void;
  onClose: () => void;
}

const DatasetBrowser: React.FC<Props> = ({ onPick, onClose }) => {
  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<CkanDataset[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const r = await searchDatasets(q || '*', 10, 0);
      setResults(r);
    } catch (e: any) {
      setError(e?.message || 'Search failed');
    } finally { setLoading(false); }
  };

  React.useEffect(() => { run(); /* initial */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const csvOrXlsx = (res: CkanResource) => /csv|xls/i.test(res.format || '') || /\.csv$|\.xlsx?$/.test(res.url || '');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass p-6 rounded-2xl w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search data.gov.ma…"
            className="flex-1 bg-white/10 border border-white/10 rounded-md text-white px-3 py-2"
          />
          <button className="px-4 py-2 bg-white/10 rounded-lg text-white" onClick={run} disabled={loading}>Search</button>
        </div>
        {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
        <div className="max-h-[60vh] overflow-auto space-y-3">
          {results.map((d) => (
            <div key={d.id} className="border border-white/10 rounded-lg p-3">
              <div className="text-white font-semibold">{d.title}</div>
              {d.organization?.title && <div className="text-xs text-gray-400">{d.organization.title}</div>}
              {d.notes && <div className="text-xs text-gray-400 mt-1 line-clamp-2">{d.notes}</div>}
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {d.resources.filter(csvOrXlsx).map((r) => (
                  <button key={r.id} className="text-left bg-white/5 hover:bg-white/10 p-2 rounded border border-white/10" onClick={() => onPick(r)}>
                    <div className="text-gray-300 text-sm">{r.name || r.url}</div>
                    <div className="text-xs text-gray-500">{r.format}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="text-right mt-4">
          <button className="px-4 py-2 bg-white/10 rounded-lg text-white" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default DatasetBrowser;


