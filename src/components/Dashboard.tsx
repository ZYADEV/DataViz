import React, { useState, useCallback, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { Upload, AlertCircle, Sparkles } from 'lucide-react';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import ChartCard from './charts/ChartCard';
import KPICard from './charts/KPICard';
import MapCard from './charts/MapCard';
import {
  DatasetProfile,
  VisualizationSuggestion,
  Theme,
  GeminiResponse,
  FilterConfig,
} from '../types';
import { parseDataFile, generateColumnStats, applyFilters, getUniqueValues, parseFromUrl } from '../utils/dataProcessing';
import { generateThemeFromDataset, applyTheme, predefinedThemes } from '../utils/theme';
import { generateVisualizationSuggestions, suggestColumnNames, generateDataAnalysisReport } from '../services/geminiApi';
import { exportAIAnalysisReport } from '../utils/pdf';
import SettingsModal from './layout/SettingsModal';
import RangeSlider from './inputs/RangeSlider';
import DateRange from './inputs/DateRange';
import CalendarPopover from './inputs/CalendarPopover';
import MultiSelect from './inputs/MultiSelect';
import { computeLocalAnalytics } from '../utils/analytics';
import DatasetBrowser from './layout/DatasetBrowser';
import { encodeFiltersToHash, decodeFiltersFromHash } from '../utils/urlState';
import { showToast } from '../utils/toast';

const Dashboard: React.FC = () => {
  // State management
  const [dataset, setDataset] = useState<DatasetProfile | null>(null);
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [visualizations, setVisualizations] = useState<VisualizationSuggestion[]>([]);
  const [theme, setTheme] = useState<Theme>(predefinedThemes[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [localInsights, setLocalInsights] = useState<string[]>([]);
  const visualizationsRef = React.useRef<HTMLDivElement | null>(null);
  const dashboardRef = React.useRef<HTMLDivElement | null>(null);
  const [drilldown, setDrilldown] = useState<{ title: string; rows: Record<string, any>[] } | null>(null);

  // Generate AI suggestions
  const generateAISuggestions = useCallback(async (datasetProfile?: DatasetProfile) => {
    if (!datasetProfile && !dataset) return;

    setIsLoading(true);
    try {
      const profile = datasetProfile || dataset!;
      const response: GeminiResponse = await generateVisualizationSuggestions(profile);

      setVisualizations(response.visualizations);
      setInsights(response.insights || []);

      // Apply theme suggestion if provided
      if (response.theme_suggestion) {
        const suggestedTheme = generateThemeFromDataset(
          profile.dataset_name,
          response.theme_suggestion.domain
        );
        setTheme(suggestedTheme);
        applyTheme(suggestedTheme);
      }
    } catch (err) {
      setError('Failed to generate AI suggestions');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [dataset]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      // Close upload modal immediately for smoother UX
      setShowUploadModal(false);
  // Parse CSV/Excel file
  const datasetProfile = await parseDataFile(file);
      const data = datasetProfile.rows || datasetProfile.sample_rows;

      // Ask Gemini to suggest better column names for generic ones
      const renameMap = await suggestColumnNames(datasetProfile);
      let prof = datasetProfile;
      if (Object.keys(renameMap).length > 0) {
        prof = {
          ...datasetProfile,
          columns: datasetProfile.columns.map(c => ({ ...c, name: renameMap[c.name] || c.name })),
          sample_rows: data.map((row) => {
            const newRow: Record<string, any> = {};
            for (const k of Object.keys(row)) {
              newRow[renameMap[k] || k] = row[k];
            }
            return newRow;
          })
        };
      }

      setDataset(prof);
      setRawData((prof as any).rows || prof.sample_rows);

      // Generate theme based on dataset
      const newTheme = generateThemeFromDataset(datasetProfile.dataset_name, datasetProfile.domain);
      setTheme(newTheme);
      applyTheme(newTheme);

      // Initialize filters based on detected column types and values
      const initialFilters: FilterConfig[] = [];
      for (const col of prof.columns) {
        if (col.type === 'string') {
          const values = getUniqueValues(data, col.name);
          // Always include string columns as multiselect, even with many values
          initialFilters.push({ column: col.name, type: 'multiselect', values: values, selected: [] });
        } else if (col.type === 'integer' || col.type === 'float') {
          const numericVals = data.map(r => parseFloat(r[col.name])).filter(v => !isNaN(v));
          if (numericVals.length > 0) {
            const min = Math.min(...numericVals);
            const max = Math.max(...numericVals);
            initialFilters.push({ column: col.name, type: 'range', min, max, selected: { min, max } });
          }
        } else if (col.type === 'date') {
          const dates = data.map(r => r[col.name]).filter(v => v !== null && v !== undefined && v !== '').map((v:any) => new Date(v)).filter(d => !isNaN(d.getTime()));
          if (dates.length > 0) {
            const minDate = new Date(Math.min(...dates.map(d => d.getTime()))).toISOString().slice(0,10);
            const maxDate = new Date(Math.max(...dates.map(d => d.getTime()))).toISOString().slice(0,10);
            initialFilters.push({ column: col.name, type: 'date_range', min: minDate, max: maxDate, selected: { min: minDate, max: maxDate } });
          }
        }
      }
      setFilters(initialFilters);

      // Generate AI suggestions
  await generateAISuggestions(prof);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process dataset');
    } finally {
      setIsLoading(false);
    }
  }, [generateAISuggestions]);

  

  // Derived filtered data
  const filteredData = useMemo(() => {
    // No filters initially: show all data
    if (!filters.some((f) => {
      if (f.type === 'multiselect') return Array.isArray(f.selected) && f.selected.length > 0;
      if (f.type === 'range') {
        const sel = f.selected || {}; return sel.min !== undefined || sel.max !== undefined;
      }
      if (f.type === 'date_range') {
        const sel = f.selected || {}; return !!sel.min || !!sel.max;
      }
      return false;
    })) {
      return rawData;
    }
    const simpleFilters = filters.map((f) => {
      if (f.type === 'multiselect') {
        const values = Array.isArray(f.selected) ? f.selected : [];
        return { column: f.column, values };
      }
      if (f.type === 'range') {
        const sel = f.selected || {};
        return { column: f.column, min: sel.min ?? f.min, max: sel.max ?? f.max };
      }
      if (f.type === 'date_range') {
        const sel = f.selected || {};
        // keep original string values; applyFilters uses numeric compare, so coerce later
        return { column: f.column, min: sel.min, max: sel.max } as any;
      }
      return { column: f.column };
    });
    return applyFilters(rawData, simpleFilters);
  }, [rawData, filters]);

  // Surprise: sharable state via URL hash (filters)
  React.useEffect(() => {
    encodeFiltersToHash(filters);
  }, [filters]);

  React.useEffect(() => {
    const preset = decodeFiltersFromHash();
    if (preset && preset.filters?.length) {
      setFilters((prev) => {
        // merge by column
        const map = new Map(prev.map((f) => [f.column, f] as const));
        preset.filters.forEach((pf) => {
          if (map.has(pf.column)) map.get(pf.column)!.selected = pf.selected as any;
        });
        return Array.from(map.values());
      });
    }
  }, []);

  // Local analytics recalculation
  React.useEffect(() => {
    if (!dataset) return;
    const summary = computeLocalAnalytics(dataset, filteredData);
    setLocalInsights(summary.lines);
  }, [dataset, filteredData]);

  // Generate KPI data
  const generateKPIData = useCallback(() => {
    if (!dataset || !filteredData.length) return [];

    const kpis = [];
    const numericColumns = dataset.columns.filter(col =>
      col.type === 'integer' || col.type === 'float'
    );

    // Total rows KPI
    kpis.push({
      title: 'Total Records',
      value: dataset.total_rows,
      icon: 'activity' as const,
    });

    // Numeric column stats
    numericColumns.slice(0, 3).forEach(col => {
      const stats = generateColumnStats(filteredData, col.name);
      kpis.push({
        title: `Avg ${col.name}`,
        value: stats.mean,
        icon: 'trending-up' as const,
      });
    });

    return kpis;
  }, [dataset, filteredData]);

  // Export dashboard as PNG
  const handleExportDashboard = async () => {
    try {
      const node = dashboardRef.current;
      if (!node) return;
      const canvas = await html2canvas(node, { backgroundColor: theme.colors.background, useCORS: true, scale: 2 });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${dataset?.dataset_name || 'dashboard'}.png`;
      a.click();
    } catch (e) {
      // fallback toast
    }
  };

  // Export AI Analysis Report as PDF
  const handleExportAIReport = async () => {
    if (!dataset) return;
    
    try {
      setIsLoading(true);
      showToast('Generating AI analysis report...');
      
      // Generate comprehensive AI analysis
      const allInsights = [...insights, ...localInsights];
      const analysisContent = await generateDataAnalysisReport(dataset, filteredData, allInsights);
      
      // Export to PDF
      await exportAIAnalysisReport(analysisContent, dataset.dataset_name);
      showToast('AI analysis report exported successfully!');
    } catch (error) {
      console.error('Error exporting AI report:', error);
      showToast('Failed to export AI analysis report');
    } finally {
      setIsLoading(false);
    }
  };

  // Upload Modal Component
  const UploadModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass p-8 max-w-md w-full rounded-2xl">
        <h2 className="text-2xl font-bold text-white mb-6">Upload Dataset</h2>

        <div
          className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center hover:border-white/40 transition-colors cursor-pointer"
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFileUpload(file);
          }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv,.xlsx,.xls';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFileUpload(file);
            };
            input.click();
          }}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-white font-medium mb-2">Drop your CSV/Excel file here</p>
          <p className="text-gray-400 text-sm">Or click to browse files</p>
        </div>

        {/* Import from URL */}
        <div className="mt-6">
          <p className="text-sm text-gray-400 mb-2">Import from URL (CSV/JSON/XLSX)</p>
          <div className="flex items-center space-x-2">
            <input
              id="dataset-url-input"
              type="url"
              placeholder="https://... (csv, json, xlsx)"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg text-white px-3 py-2 placeholder-gray-500"
            />
            <button
              onClick={async () => {
                const input = document.getElementById('dataset-url-input') as HTMLInputElement | null;
                const url = input?.value?.trim();
                if (!url) return;
                try {
                  setIsLoading(true);
                  const prof = await parseFromUrl(url);
                  setShowUploadModal(false);
                  // feed into same flow as file upload
                  setDataset(prof);
                  setRawData(prof.rows || prof.sample_rows);
                  const newTheme = generateThemeFromDataset(prof.dataset_name, prof.domain);
                  setTheme(newTheme); applyTheme(newTheme);
                  // init filters
                  const initial: FilterConfig[] = [];
                  for (const col of prof.columns) {
                    if (col.type === 'string') {
                      const values = getUniqueValues(prof.rows || prof.sample_rows, col.name);
                      initial.push({ column: col.name, type: 'multiselect', values, selected: [] });
                    } else if (col.type === 'integer' || col.type === 'float') {
                      const nums = (prof.rows || prof.sample_rows).map(r => parseFloat(r[col.name])).filter(v => !isNaN(v));
                      if (nums.length) initial.push({ column: col.name, type: 'range', min: Math.min(...nums), max: Math.max(...nums), selected: { min: Math.min(...nums), max: Math.max(...nums) } });
                    } else if (col.type === 'date') {
                      const dates = (prof.rows || prof.sample_rows).map(r => r[col.name]).filter(Boolean).map((v:any) => new Date(v)).filter((d:any) => !isNaN(d.getTime()));
                      if (dates.length) {
                        const minDate = new Date(Math.min(...dates.map(d => d.getTime()))).toISOString().slice(0,10);
                        const maxDate = new Date(Math.max(...dates.map(d => d.getTime()))).toISOString().slice(0,10);
                        initial.push({ column: col.name, type: 'date_range', min: minDate, max: maxDate, selected: { min: minDate, max: maxDate } });
                      }
                    }
                  }
                  setFilters(initial);
                  await generateAISuggestions(prof);
                } catch (e) {
                  setError('Failed to import from URL');
                } finally {
                  setIsLoading(false);
                }
              }}
              className="px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: theme.colors.primary }}
            >
              Import
            </button>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={() => setShowUploadModal(false)}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-black">
      {/* Sidebar */}
      <Sidebar
        theme={theme}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        currentDataset={dataset?.dataset_name}
        onDatasetUpload={() => setShowUploadModal(true)}
        onSettingsClick={() => setShowSettingsModal(true)}
        onShowFilters={() => {
          document.querySelector('#filters-anchor')?.scrollIntoView({ behavior: 'smooth' });
        }}
        onShowInsights={() => {
          document.querySelector('#insights-anchor')?.scrollIntoView({ behavior: 'smooth' });
        }}
        onShowProfile={() => {
          document.querySelector('#profile-anchor')?.scrollIntoView({ behavior: 'smooth' });
        }}
        onExportPNG={handleExportDashboard}
        onExportAIReport={handleExportAIReport}
      />

      {/* Main Content */}
      <div className={`${sidebarCollapsed ? 'pl-20' : 'pl-72'} transition-[padding] duration-300 ease-in-out`}>
        {/* Header */}
        <Header
          theme={theme}
          dataset={dataset}
          onAISuggestions={() => generateAISuggestions()}
          onExportDashboard={handleExportDashboard}
          onRefreshData={() => {
            if (dataset) {
              generateAISuggestions(dataset);
              showToast('Data refreshed');
            }
          }}
          onExportAIReport={handleExportAIReport}
          isLoading={isLoading}
        />

        {/* Main Dashboard Content */}
        <div className="p-6" ref={dashboardRef}>
          {/* Filters Bar */}
          <div id="filters-anchor" />
          {dataset && filters.length > 0 && (
            <div className="glass p-4 rounded-xl mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold">Filters</h3>
                <button
                  onClick={() => {
                    // Clear selections
                    setFilters((prev) => prev.map((f) => {
                      if (f.type === 'multiselect') return { ...f, selected: [] };
                      if (f.type === 'range') return { ...f, selected: { min: f.min, max: f.max } };
                      if (f.type === 'date_range') return { ...f, selected: { min: f.min, max: f.max } };
                      return f;
                    }));
                  }}
                  className="text-sm text-gray-300 hover:text-white"
                >
                  Clear all
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filters.map((f) => (
                  <div key={f.column} className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-2">{f.column}</p>
                    {f.type === 'multiselect' && (
                      <div className="relative">
                        <MultiSelect
                          options={((f.values || []) as any[]).map((v) => String(v))}
                          values={(Array.isArray(f.selected) ? f.selected : []).map((s: any) => String(s))}
                          onChange={(vals: string[]) => setFilters((prev) => prev.map((pf) => pf.column === f.column ? { ...pf, selected: vals } : pf))}
                        />
                      </div>
                    )}
                    {f.type === 'range' && (
                      <RangeSlider
                        min={Number(f.min ?? 0)}
                        max={Number(f.max ?? 0)}
                        valueMin={Number((f.selected?.min ?? f.min) as number)}
                        valueMax={Number((f.selected?.max ?? f.max) as number)}
                        step={Math.max(1, Math.round((Number(f.max ?? 0) - Number(f.min ?? 0)) / 100))}
                        onChange={(a, b) => setFilters((prev) => prev.map((pf) => pf.column === f.column ? { ...pf, selected: { min: a, max: b } } : pf))}
                      />
                    )}
                    {f.type === 'date_range' && (
                      <div>
                        <div className="mb-2">
                          <CalendarPopover
                            min={String(f.min ?? '')}
                            max={String(f.max ?? '')}
                            valueMin={String(f.selected?.min ?? f.min ?? '')}
                            valueMax={String(f.selected?.max ?? f.max ?? '')}
                            onChange={(min, max) => setFilters((prev) => prev.map((pf) => pf.column === f.column ? { ...pf, selected: { min, max } } : pf))}
                          />
                        </div>
                        <DateRange
                          min={String(f.min ?? '')}
                          max={String(f.max ?? '')}
                          valueMin={String(f.selected?.min ?? f.min ?? '')}
                          valueMax={String(f.selected?.max ?? f.max ?? '')}
                          onChange={(min, max) => setFilters((prev) => prev.map((pf) => pf.column === f.column ? { ...pf, selected: { min, max } } : pf))}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="glass border-l-4 border-red-500 p-4 mb-6">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
                <p className="text-white">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-red-500 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {!dataset ? (
            // Welcome State
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full glass flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-gray-400" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Welcome to DataViz AI
                </h2>
                <p className="text-gray-400 text-lg mb-8 max-w-md">
                  Upload your dataset and let AI generate beautiful, insightful visualizations automatically.
                </p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-8 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105"
                  style={{
                    backgroundColor: theme.colors.primary,
                    color: 'white'
                  }}
                >
                  Upload Your First Dataset
                </button>
              </div>
            </div>
          ) : (
            // Dashboard Content
            <>
              {/* AI Insights */}
              <div id="insights-anchor" />
              {(insights.length > 0 || localInsights.length > 0) && (
                <div className="glass p-4 rounded-xl mb-6">
                  <h3 className="text-white font-semibold mb-2">AI Insights</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                      {insights.slice(0, 5).map((ins, idx) => (
                        <li key={idx}>{ins}</li>
                      ))}
                    </ul>
                    {dataset && (
                      <div className="text-xs text-gray-300 bg-white/5 rounded p-3">
                        {(() => {
                          // local quick facts
                          const numCols = dataset.columns.filter(c => c.type === 'integer' || c.type === 'float');
                          const catCols = dataset.columns.filter(c => c.type === 'string');
                          const facts: string[] = [];
                          if (numCols.length > 0) facts.push(`Key numeric columns: ${numCols.map(c => c.name).slice(0,3).join(', ')}`);
                          if (catCols.length > 0) facts.push(`Key categorical columns: ${catCols.map(c => c.name).slice(0,3).join(', ')}`);
                          facts.push(`Rows: ${dataset.total_rows.toLocaleString()}, Columns: ${dataset.columns.length}`);
                          return (
                            <ul className="list-disc list-inside space-y-1">
                              {facts.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          );
                        })()}
                        {localInsights.length > 0 && (
                          <>
                            <div className="border-t border-white/10 my-2" />
                            <ul className="list-disc list-inside space-y-1">
                              {localInsights.slice(0, 5).map((t, i) => (
                                <li key={i}>{t}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* KPI Cards */}
              <div id="profile-anchor" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {generateKPIData().map((kpi, index) => (
                  <KPICard
                    key={index}
                    title={kpi.title}
                    value={kpi.value}
                    icon={kpi.icon}
                    theme={theme}
                  />
                ))}
              </div>

              {/* Visualizations Grid */}
              {visualizations.length > 0 ? (
                <div ref={visualizationsRef} className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 will-change-transform min-w-0">
                  {visualizations.map((viz, index) => (
                    viz.chart_type === 'KPI' ? (
                      <KPICard
                        key={index}
                        title={viz.description}
                        value={generateKPIData()[0]?.value || dataset?.total_rows || 0}
                        icon={'activity'}
                        theme={theme}
                        size="small"
                      />
                    ) : viz.chart_type === 'map' ? (
                      <MapCard
                        key={index}
                        data={filteredData}
                        latKey={viz.y_axis || 'lat'}
                        lonKey={viz.x_axis || 'lon'}
                        labelKeys={[viz.group_by || '', viz.x_axis, viz.y_axis].filter(Boolean) as string[]}
                      />
                    ) : (
                      <ChartCard
                        key={index}
                        visualization={viz}
                        data={filteredData}
                        theme={theme}
                        size={'large'}
                        disableAnimation={true}
                        onPointClick={(payload) => {
                          // Simple drill-down: show matching rows for x/y selection if available
                          try {
                            const xKey = viz.x_axis;
                            const yKey = viz.y_axis;
                            const match = filteredData.filter((r) => {
                              const xVal = String(r[xKey]);
                              const yVal = yKey ? String(r[yKey]) : undefined;
                              const px = payload && payload.payload ? String(payload.payload[xKey]) : undefined;
                              const py = payload && payload.payload && yKey ? String(payload.payload[yKey]) : undefined;
                              return px === xVal && (!yKey || py === yVal);
                            }).slice(0, 20);
                            setDrilldown({ title: viz.description || 'Details', rows: match });
                          } catch {}
                        }}
                      />
                    )
                  ))}
                </div>
              ) : !isLoading && (
                <div className="glass p-8 text-center">
                  <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    No Visualizations Yet
                  </h3>
                  <p className="text-gray-400 mb-6">
                    Click "AI Suggestions" to generate visualizations for your dataset.
                  </p>
                  <button
                    onClick={() => generateAISuggestions()}
                    className="px-6 py-2 rounded-lg font-medium"
                    style={{
                      backgroundColor: theme.colors.primary,
                      color: 'white'
                    }}
                  >
                    Generate Visualizations
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {showUploadModal && <UploadModal />}
      {/* Drilldown modal */}
      {drilldown && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDrilldown(null)}>
          <div className="glass p-6 rounded-2xl w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-3">{drilldown.title}</h3>
            <div className="max-h-[60vh] overflow-auto text-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400">
                    {dataset?.columns.map((c) => (
                      <th key={c.name} className="py-1 pr-3">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  {drilldown.rows.map((r, i) => (
                    <tr key={i} className="border-t border-white/5">
                      {dataset?.columns.map((c) => (
                        <td key={c.name} className="py-1 pr-3 whitespace-nowrap">{String(r[c.name])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-right mt-4">
              <button className="px-4 py-2 bg-white/10 rounded-lg text-white" onClick={() => setDrilldown(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {showBrowser && (
        <DatasetBrowser
          onPick={async (res) => {
            setShowBrowser(false);
            try {
              setIsLoading(true);
              const resp = await fetch(res.url);
              const blob = await resp.blob();
              const fileName = res.name || 'remote.csv';
              const file = new File([blob], fileName, { type: blob.type || 'text/csv' });
              await handleFileUpload(file);
            } catch (e) {
              showToast('Failed to import selected resource');
            } finally { setIsLoading(false); }
          }}
          onClose={() => setShowBrowser(false)}
        />
      )}
      {showSettingsModal && (
        <SettingsModal
          theme={theme}
          predefined={predefinedThemes}
          onClose={() => setShowSettingsModal(false)}
          onApply={(t: Theme) => {
            setTheme(t);
            applyTheme(t);
            setShowSettingsModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
