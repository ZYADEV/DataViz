import React from 'react';
import Popover from './Popover';

interface Props {
  min?: string;
  max?: string;
  valueMin?: string;
  valueMax?: string;
  onChange: (min?: string, max?: string) => void;
}

const CalendarPopover: React.FC<Props> = ({ min, max, valueMin, valueMax, onChange }) => {
  // Minimal calendar: reuse native date inputs inside popover for now (lightweight)
  return (
    <Popover trigger={<span className="text-sm">Pick dates</span>} align="left">
      <div className="flex items-center gap-2">
        <input
          type="date"
          min={min}
          max={max}
          value={valueMin}
          onChange={(e) => onChange(e.target.value || undefined, valueMax)}
          className="bg-white/10 border border-white/10 rounded-md text-white p-2"
        />
        <span className="text-gray-400">to</span>
        <input
          type="date"
          min={min}
          max={max}
          value={valueMax}
          onChange={(e) => onChange(valueMin, e.target.value || undefined)}
          className="bg-white/10 border border-white/10 rounded-md text-white p-2"
        />
      </div>
    </Popover>
  );
};

export default CalendarPopover;


