import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartCardProps } from '../../types';
import { TrendingUp, Download } from 'lucide-react';

const ChartCard: React.FC<ChartCardProps> = ({
  visualization,
  data,
  theme,
  size = 'medium',
  onExport,
  disableAnimation,
  onPointClick,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [chartType, setChartType] = React.useState(visualization.chart_type);
  const [selectedGroup, setSelectedGroup] = React.useState<string | 'ALL'>('ALL');
  const sizeClasses = {
    small: 'h-64 col-span-1',
    medium: 'h-96 col-span-1 md:col-span-2',
    large: 'h-[28rem] col-span-1 md:col-span-2 lg:col-span-3',
  };

  const getGroupedCategories = React.useMemo(() => {
    if (!visualization.group_by) return [] as string[];
    const values = Array.from(new Set(
      data
        .map((r) => r[visualization.group_by!])
        .filter((v) => v !== undefined && v !== null && String(v) !== '')
        .map((v) => String(v))
    ));
    // Limit to top 5 by frequency
    const freq = new Map<string, number>();
    values.forEach((v) => freq.set(v, 0));
    data.forEach((r) => {
      const v = String(r[visualization.group_by!]);
      if (freq.has(v)) freq.set(v, (freq.get(v) || 0) + 1);
    });
    return values.sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0)).slice(0, 5);
  }, [data, visualization.group_by]);

  const filteredByGroup = React.useMemo(() => {
    if (!visualization.group_by || selectedGroup === 'ALL') return data;
    return data.filter((r) => String(r[visualization.group_by!]) === selectedGroup);
  }, [data, visualization.group_by, selectedGroup]);

  // Surprise: one-click explain chart (local heuristic)
  const explain = (): string => {
    const type = chartType;
    if (type === 'scatter' && visualization.x_axis && visualization.y_axis) {
      const xs = filteredByGroup.map((r) => Number(r[visualization.x_axis])).filter((n) => !isNaN(n));
      const ys = filteredByGroup.map((r) => Number(r[visualization.y_axis!])).filter((n) => !isNaN(n));
      if (xs.length > 3 && ys.length > 3) {
        const r = (() => {
          const n = Math.min(xs.length, ys.length);
          const mx = xs.reduce((a, b) => a + b, 0) / n;
          const my = ys.reduce((a, b) => a + b, 0) / n;
          let num = 0, denx = 0, deny = 0;
          for (let i = 0; i < n; i++) { const dx = xs[i] - mx; const dy = ys[i] - my; num += dx * dy; denx += dx*dx; deny += dy*dy; }
          const den = Math.sqrt(denx) * Math.sqrt(deny); return den === 0 ? 0 : num / den;
        })();
        return `Correlation (${visualization.x_axis} vs ${visualization.y_axis}): r=${Math.round(r*100)/100}`;
      }
    }
    if (type === 'bar' && visualization.y_axis) {
      return `Top categories by ${visualization.y_axis} shown (aggregated)`;
    }
    if (type === 'line' && visualization.x_axis && visualization.y_axis) {
      return `Trend of ${visualization.y_axis} over ${visualization.x_axis}${visualization.group_by ? ` grouped by ${visualization.group_by}` : ''}`;
    }
    return visualization.description || 'Chart explanation';
  };

  const renderChart = () => {
    const chartProps = {
      data: filteredByGroup,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    const colors = theme.colors.chart_palette;

    switch (chartType) {
      case 'bar':
        // Aggregate top 10 categories by y_axis if both axes provided
        let barData = filteredByGroup;
        if (visualization.x_axis && visualization.y_axis) {
          const map = new Map<string, number>();
          for (const row of filteredByGroup) {
            const key = String(row[visualization.x_axis]);
            const val = parseFloat(row[visualization.y_axis]);
            if (!isNaN(val)) {
              map.set(key, (map.get(key) || 0) + val);
            }
          }
          barData = Array.from(map.entries())
            .map(([k, v]) => {
              const obj: Record<string, any> = {};
              obj[visualization.x_axis] = k;
              if (visualization.y_axis) obj[visualization.y_axis] = v;
              return obj;
            })
            .sort((a, b) => (b[visualization.y_axis!] as number) - (a[visualization.y_axis!] as number))
            .slice(0, 10);
        }
        // If group_by exists and selectedGroup is ALL, draw multi-series stacked bar of top groups
        if (visualization.group_by && selectedGroup === 'ALL') {
          // Build pivot: x -> group -> value
          const groupKeys = getGroupedCategories;
          const pivot = new Map<string, Record<string, any>>();
          for (const row of filteredByGroup) {
            const x = String(row[visualization.x_axis]);
            const g = String(row[visualization.group_by]);
            const y = visualization.y_axis ? parseFloat(row[visualization.y_axis]) : 1;
            if (!pivot.has(x)) pivot.set(x, { [visualization.x_axis]: x });
            if (groupKeys.includes(g) && !isNaN(y)) {
              pivot.get(x)![g] = (pivot.get(x)![g] || 0) + y;
            }
          }
          const pivotData = Array.from(pivot.values());
          return (
            <BarChart data={pivotData} margin={chartProps.margin}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey={visualization.x_axis} tick={{ fill: 'rgba(255,255,255,0.7)' }} interval={0} angle={-10} height={50} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.7)' }} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(13,13,20,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              <Legend />
              {getGroupedCategories.map((g, i) => (
                <Bar key={g} dataKey={g} stackId="a" fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          );
        }
        return (
          <BarChart {...chartProps} data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey={visualization.x_axis} tick={{ fill: 'rgba(255,255,255,0.7)' }} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.7)' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(13,13,20,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Bar
              dataKey={visualization.y_axis}
              fill={colors[0]}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );

      case 'line': {
        if (visualization.group_by && selectedGroup === 'ALL') {
          // Multi-series line by top groups
          const groupKeys = getGroupedCategories;
          // Build x-axis unique sorted
          const xs = Array.from(new Set(filteredByGroup.map((r) => r[visualization.x_axis]))).map((v) => String(v));
          const rows = xs.map((x) => {
            const row: Record<string, any> = { [visualization.x_axis]: x };
            groupKeys.forEach((g) => {
              row[g] = 0;
            });
            return row;
          });
          filteredByGroup.forEach((r) => {
            const x = String(r[visualization.x_axis]);
            const g = String(r[visualization.group_by!]);
            const y = visualization.y_axis ? parseFloat(r[visualization.y_axis]) : 0;
            const row = rows.find((rr) => rr[visualization.x_axis] === x);
            if (row && groupKeys.includes(g) && !isNaN(y)) row[g] = (row[g] || 0) + y;
          });
          return (
            <LineChart data={rows} margin={chartProps.margin}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey={visualization.x_axis} tick={{ fill: 'rgba(255,255,255,0.7)' }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.7)' }} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(13,13,20,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              <Legend />
              {getGroupedCategories.map((g, i) => (
                <Line key={g} type="monotone" dataKey={g} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          );
        }
        return (
          <LineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey={visualization.x_axis} tick={{ fill: 'rgba(255,255,255,0.7)' }} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.7)' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(13,13,20,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={visualization.y_axis}
              stroke={colors[0]}
              strokeWidth={3}
              dot={{ fill: colors[0], strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: theme.colors.primary }}
            />
          </LineChart>
        );
      }

      case 'area':
        // Area used for simple distribution over x_axis (numeric)
        return (
          <AreaChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey={visualization.x_axis} tick={{ fill: 'rgba(255,255,255,0.7)' }} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.7)' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(13,13,20,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
              }}
            />
            <Area
              type="monotone"
              dataKey={visualization.y_axis || visualization.x_axis}
              stroke={colors[0]}
              fill={`${colors[0]}40`}
              strokeWidth={2}
            />
          </AreaChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey={visualization.x_axis} tick={{ fill: 'rgba(255,255,255,0.7)' }} />
            <YAxis dataKey={visualization.y_axis} tick={{ fill: 'rgba(255,255,255,0.7)' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(13,13,20,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
              }}
            />
            <Scatter fill={colors[0]} onClick={(p) => onPointClick && onPointClick(p)} />
          </ScatterChart>
        );

      case 'pie':
        // Aggregate counts or sum of y over categories
        const agg = new Map<string, number>();
        for (const row of filteredByGroup) {
          const key = String(row[visualization.x_axis]);
          let value = 1;
          if (visualization.y_axis) {
            const num = parseFloat(row[visualization.y_axis]);
            if (!isNaN(num)) value = num;
          }
          agg.set(key, (agg.get(key) || 0) + value);
        }
        const pieData = Array.from(agg.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);

        return (
          <PieChart width={400} height={300}>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
            >
              {pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(13,13,20,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        );

      case 'histogram': {
        // Build histogram bins for a numeric column (x_axis)
        const values = filteredByGroup
          .map((r) => parseFloat(r[visualization.x_axis]))
          .filter((n) => !isNaN(n));
        if (values.length === 0) {
          return <div className="flex items-center justify-center h-full text-gray-400">No numeric data</div>;
        }
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binCount = 10;
        const binSize = (max - min) / (binCount || 1) || 1;
        const bins = Array.from({ length: binCount }, (_, i) => ({
          bin: `${(min + i * binSize).toFixed(1)}-${(min + (i + 1) * binSize).toFixed(1)}`,
          count: 0,
        }));
        values.forEach((v) => {
          let idx = Math.floor((v - min) / binSize);
          if (idx >= binCount) idx = binCount - 1;
          if (idx < 0) idx = 0;
          bins[idx].count += 1;
        });
        return (
          <BarChart {...chartProps} data={bins}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="bin" tick={{ fill: 'rgba(255,255,255,0.7)' }} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.7)' }} />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(13,13,20,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
            <Bar dataKey="count" fill={colors[1]} radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      }

      case 'heatmap': {
        // Build category frequency matrix for x vs group_by or y_axis if categorical
        const yKey = visualization.group_by || visualization.y_axis || visualization.x_axis;
        const xVals = Array.from(new Set(filteredByGroup.map((r) => String(r[visualization.x_axis]))));
        const yVals = Array.from(new Set(filteredByGroup.map((r) => String(r[yKey!]))));
        const counts = new Map<string, number>();
        filteredByGroup.forEach((r) => {
          const x = String(r[visualization.x_axis]);
          const y = String(r[yKey!]);
          const k = `${x}|||${y}`;
          counts.set(k, (counts.get(k) || 0) + 1);
        });
        const maxCount = Math.max(1, ...Array.from(counts.values()));
        return (
          <div className="w-full h-full overflow-auto" ref={containerRef}>
            <div className="grid" style={{ gridTemplateColumns: `120px repeat(${xVals.length}, minmax(40px, 1fr))`, gap: 4 }}>
              <div></div>
              {xVals.map((x) => (
                <div key={x} className="text-xs text-gray-300 text-center truncate">{x}</div>
              ))}
              {yVals.map((y) => (
                <React.Fragment key={y}>
                  <div className="text-xs text-gray-300 truncate">{y}</div>
                  {xVals.map((x, i) => {
                    const c = counts.get(`${x}|||${y}`) || 0;
                    const intensity = c / maxCount;
                    const color = colors[0];
                    return (
                      <div key={`${y}-${i}`} className="rounded" title={`${y} / ${x}: ${c}`}
                        style={{ backgroundColor: `${color}${Math.round(intensity * 180 + 30).toString(16).padStart(2, '0')}`, height: 24 }}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            Chart type not supported
          </div>
        );
    }
  };

  // Export current chart area to PNG (SVG to canvas)
  const handleExport = async () => {
    try {
      // find the nearest svg inside this card
      const card = containerRef.current?.closest('.chart-card-root') || undefined;
      const svg = (card as HTMLElement | undefined)?.querySelector('svg');
      if (!svg) return;
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#0D0D14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${visualization.description || 'chart'}.png`;
          a.click();
        });
      };
      img.src = url;
    } catch {
      // noop
    }
  };

  return (
    <div className={`glass glass-hover p-6 ${disableAnimation ? '' : 'animate-fade-in'} ${sizeClasses[size]} chart-card-root`} ref={containerRef} style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${theme.colors.primary}20` }}>
            <TrendingUp className="w-4 h-4" style={{ color: theme.colors.primary }} />
          </div>
          <div>
            <h3 className="font-semibold text-white">{visualization.description}</h3>
            <p className="text-sm text-gray-400 capitalize">{chartType} Chart</p>
            <p className="text-xs text-gray-500 max-w-[28rem] truncate" title={explain()}>{explain()}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Chart type switcher */}
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as any)}
            className="bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/10"
          >
            {['bar', 'line', 'area', 'pie', 'scatter', 'histogram', 'heatmap'].map((t) => (
              <option key={t} value={t} className="bg-gray-900">{t}</option>
            ))}
          </select>
            <button
            onClick={onExport || handleExport}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Export chart as PNG"
            >
              <Download className="w-4 h-4 text-gray-400" />
            </button>
        </div>
      </div>

      {/* Per-chart group selector */}
      {visualization.group_by && (
        <div className="mb-2 flex items-center space-x-2 overflow-hidden">
          <span className="text-xs text-gray-400">Group:</span>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value as any)}
            className="bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/10 max-w-[60%] truncate"
          >
            <option value="ALL" className="bg-gray-900">All (top)</option>
            {getGroupedCategories.map((g) => (
              <option key={g} value={g} className="bg-gray-900">{g}</option>
            ))}
          </select>
        </div>
      )}

      {/* Chart */}
      <div className="h-full overflow-hidden">
        <ResponsiveContainer width="100%" height="85%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-xs text-gray-400">{visualization.reason}</p>
      </div>
    </div>
  );
};

export default ChartCard;
