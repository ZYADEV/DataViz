import React from 'react';

interface Props {
  min?: string;
  max?: string;
  valueMin?: string;
  valueMax?: string;
  onChange: (min?: string, max?: string) => void;
}

// Lightweight date-range input with a single-line UI; can be swapped for a picker later
const DateRange: React.FC<Props> = ({ min, max, valueMin, valueMax, onChange }) => {
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        min={min}
        max={max}
        value={valueMin}
        onChange={(e) => onChange(e.target.value || undefined, valueMax)}
        className="flex-1 bg-white/10 border border-white/10 rounded-md text-white p-2"
      />
      <span className="text-gray-400">to</span>
      <input
        type="date"
        min={min}
        max={max}
        value={valueMax}
        onChange={(e) => onChange(valueMin, e.target.value || undefined)}
        className="flex-1 bg-white/10 border border-white/10 rounded-md text-white p-2"
      />
    </div>
  );
};

export default DateRange;


