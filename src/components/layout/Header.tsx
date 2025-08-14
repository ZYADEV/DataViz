import React from 'react';
import { Sparkles, Download, RefreshCw, Database, Users, Calendar, FileText } from 'lucide-react';
import { Theme, DatasetProfile } from '../../types';

interface HeaderProps {
  theme: Theme;
  dataset?: DatasetProfile | null;
  onAISuggestions: () => void;
  onExportDashboard: () => void;
  onRefreshData: () => void;
  onExportAIReport: () => void;
  isLoading?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  theme,
  dataset,
  onAISuggestions,
  onExportDashboard,
  onRefreshData,
  onExportAIReport,
  isLoading = false,
}) => {
  return (
    <div className="glass border-b border-white/10 px-6 py-4 ml-6 mr-6 sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5">
      <div className="flex items-center justify-between">
        {/* Dataset info */}
        <div className="flex items-center space-x-4">
          {dataset ? (
            <div className="flex items-center space-x-3">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${theme.colors.primary}20` }}
              >
                <Database className="w-5 h-5" style={{ color: theme.colors.primary }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{dataset.dataset_name}</h2>
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span className="flex items-center space-x-1">
                    <Users className="w-4 h-4" />
                    <span>{dataset.total_rows.toLocaleString()} rows</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>{dataset.columns.length} columns</span>
                  </span>
                  {dataset.domain && (
                    <span className="px-2 py-1 rounded-full text-xs bg-white/10">{dataset.domain}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-white/5">
                <Database className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-400">No Dataset Loaded</h2>
                <p className="text-sm text-gray-500">Upload a dataset to get started</p>
            </div>
          </div>
        )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          {dataset && (
            <>
            <button
                onClick={onAISuggestions}
                disabled={isLoading}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                style={{ backgroundColor: theme.colors.primary, color: 'white' }}
              >
                <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Analyzing...' : 'AI Suggestions'}</span>
              </button>
              <button onClick={onRefreshData} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Refresh Data">
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
              <button onClick={onExportDashboard} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Export PNG">
                <Download className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={onExportAIReport}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Export AI Analysis Report"
              >
                <FileText className="w-4 h-4 text-gray-400" />
              </button>
              {/*<button className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Share Dashboard">
                <Share className="w-4 h-4 text-gray-400" />
              </button>*/}
                </>
              )}
        </div>
            </div>
      {isLoading && (
        <div className="mt-4">
          <div className="w-full bg-white/10 rounded-full h-1">
            <div className="h-1 rounded-full" style={{ backgroundColor: theme.colors.primary, width: '100%', animation: 'pulse 2s infinite' }} />
          </div>
          <p className="text-xs text-gray-400 mt-2">Generating AI-powered visualizations...</p>
          </div>
        )}
    </div>
  );
};

export default Header;