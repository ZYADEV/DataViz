import React from 'react';
import {
  BarChart3,
  Settings,
  Upload,
  Bookmark,
  ChevronLeft,
  FileText,
  Download,
  FileDown
} from 'lucide-react';
import { Theme } from '../../types';

interface SidebarProps {
  theme: Theme;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentDataset?: string;
  onDatasetUpload: () => void;
  onSettingsClick: () => void;
  onShowFilters?: () => void;
  onShowInsights?: () => void;
  onShowProfile?: () => void;
  onExportPNG?: () => void;
  onExportAIReport?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  theme,
  isCollapsed,
  onToggleCollapse,
  currentDataset,
  onDatasetUpload,
  onSettingsClick,
  onShowFilters,
  onShowInsights,
  onShowProfile,
  onExportPNG,
  onExportAIReport,
}) => {

  const menuItems = [
    {
      id: 'filters',
      label: 'Filters',
      icon: BarChart3,
      active: false,
      onClick: onShowFilters,
    },
    {
      id: 'insights',
      label: 'AI Insights',
      icon: Bookmark,
      active: false,
      onClick: onShowInsights,
    },
    {
      id: 'profile',
      label: 'Data Profile',
      icon: FileText,
      active: false,
      onClick: onShowProfile,
    },
    {
      id: 'export-png',
      label: 'Export PNG',
      icon: Download,
      active: false,
      onClick: onExportPNG,
    },
    {
      id: 'export-ai-report',
      label: 'AI Analysis Report',
      icon: FileDown,
      active: false,
      onClick: onExportAIReport,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      active: false,
      onClick: onSettingsClick,
    },
  ];

  return (
    <div className={`
      fixed left-0 top-0 h-full glass border-r border-white/10 z-40
      transition-[width] duration-300 ease-in-out
      ${isCollapsed ? 'w-20' : 'w-72'}
    `}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: theme.colors.primary }}
              >
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h1 className="font-bold text-lg text-white">DataViz AI</h1>
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronLeft
              className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${
                isCollapsed ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {/* no search – simplified nav */}

        {/* Upload Dataset Button */}
        <div className="p-4">
          <button
            onClick={onDatasetUpload}
            className={`
              w-full flex items-center justify-center space-x-2 py-3 rounded-lg
              transition-all duration-200 hover:scale-105
              ${isCollapsed ? 'px-3' : 'px-4'}
            `}
            style={{
              backgroundColor: theme.colors.primary,
              color: 'white'
            }}
          >
            <Upload className="w-5 h-5" />
            {!isCollapsed && <span className="font-medium">Upload Dataset</span>}
          </button>
        </div>

        {/* Current Dataset */}
        {currentDataset && !isCollapsed && (
          <div className="px-4 mb-4">
            <div className="glass p-3 rounded-lg border border-white/10">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400">Current Dataset</p>
                  <p className="text-sm font-medium text-white truncate">
                    {currentDataset}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`
                w-full flex items-center space-x-3 p-3 rounded-lg transition-all duration-200
                ${item.active 
                  ? 'bg-white/10 border border-white/20' 
                  : 'hover:bg-white/5'
                }
                ${isCollapsed ? 'justify-center' : 'justify-start'}
              `}
            >
              <item.icon className="w-7 h-7 text-gray-300" />
              {!isCollapsed && (
                <>
                  <span className="text-sm font-medium text-white flex-1 text-left">
                    {item.label}
                  </span>
                   {/* badges removed */}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-white/10">
            <div className="text-xs text-gray-400 text-center">
              <p>Build By YOUNESS</p>
              <p className="mt-1">v1.0.0</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
