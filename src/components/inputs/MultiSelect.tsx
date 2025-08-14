import React from 'react';

interface Props {
  options: string[];
  values: string[];
  placeholder?: string;
  onChange: (values: string[]) => void;
}

const MultiSelect: React.FC<Props> = ({ options, values, placeholder = 'Search...', onChange }) => {
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(
    () => options.filter((v) => v.toLowerCase().includes(query.toLowerCase())).slice(0, 1000),
    [options, query]
  );

  const toggle = (val: string) => {
    const set = new Set(values);
    if (set.has(val)) set.delete(val); else set.add(val);
    onChange(Array.from(set));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-white/10 border border-white/10 rounded-md text-white px-2 py-1 text-sm placeholder-gray-400"
        />
        <button className="text-xs text-gray-300 hover:text-white" onClick={() => onChange(options)}>All</button>
        <button className="text-xs text-gray-300 hover:text-white" onClick={() => onChange([])}>None</button>
      </div>
      <div className="h-28 overflow-auto rounded border border-white/10">
        {filtered.map((v) => {
          const checked = values.includes(v);
          return (
            <label key={v} className="flex items-center gap-2 px-2 py-1 text-sm text-white/90 bg-white/5 hover:bg-white/10 cursor-pointer">
              <input type="checkbox" checked={checked} onChange={() => toggle(v)} />
              <span className="truncate">{v}</span>
            </label>
          );
        })}
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 max-h-16 overflow-auto">
          {values.slice(0, 10).map((v) => (
            <span key={v} className="text-xs px-2 py-1 rounded bg-white/10 text-white">{v}</span>
          ))}
          {values.length > 10 && <span className="text-xs text-gray-400">+{values.length - 10} more</span>}
        </div>
      )}
    </div>
  );
};

export default MultiSelect;


