import React from 'react';

interface Props {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  step?: number;
  onChange: (nextMin: number, nextMax: number) => void;
}

// Dual range slider with filled track; keyboard accessible and lightweight
const RangeSlider: React.FC<Props> = ({ min, max, valueMin, valueMax, step = 1, onChange }) => {
  const rangeRef = React.useRef<HTMLDivElement | null>(null);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = clamp(parseFloat(e.target.value));
    const newMin = Math.min(next, valueMax);
    onChange(newMin, valueMax);
  };
  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = clamp(parseFloat(e.target.value));
    const newMax = Math.max(next, valueMin);
    onChange(valueMin, newMax);
  };

  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const left = pct(valueMin);
  const right = pct(valueMax);

  return (
    <div className="w-full">
      {/* Slider track */}
      <div className="relative h-2 rounded bg-white/10 w-full" ref={rangeRef}>
        <div
          className="absolute h-2 rounded bg-white/40"
          style={{ left: `${left}%`, width: `${right - left}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMin}
          onChange={handleMinChange}
          className="absolute w-full h-2 appearance-none bg-transparent pointer-events-auto"
          style={{ zIndex: 2 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMax}
          onChange={handleMaxChange}
          className="absolute w-full h-2 appearance-none bg-transparent pointer-events-auto"
          style={{ zIndex: 3 }}
        />
      </div>
      {/* Compact numeric inputs (fit content) */}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <input
          type="number"
          value={valueMin}
          onChange={(e) => handleMinChange(e as any)}
          inputMode="decimal"
          step={step}
          className="w-32 bg-white/10 border border-white/10 rounded-md text-white p-2"
        />
        <span className="text-gray-400">to</span>
        <input
          type="number"
          value={valueMax}
          onChange={(e) => handleMaxChange(e as any)}
          inputMode="decimal"
          step={step}
          className="w-32 bg-white/10 border border-white/10 rounded-md text-white p-2"
        />
      </div>
    </div>
  );
};

export default RangeSlider;


