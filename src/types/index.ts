// Core data types
export interface DatasetColumn {
  name: string;
  type: 'string' | 'integer' | 'float' | 'date' | 'boolean';
  unique_values: number;
  min?: number | string;
  max?: number | string;
  sample_values?: (string | number)[];
}

export interface DatasetProfile {
  dataset_name: string;
  domain?: string;
  columns: DatasetColumn[];
  sample_rows: Record<string, any>[];
  rows?: Record<string, any>[];
  total_rows: number;
}

// Visualization types
export interface VisualizationSuggestion {
  chart_type: 'bar' | 'line' | 'pie' | 'scatter' | 'KPI' | 'heatmap' | 'map' | 'area' | 'histogram';
  x_axis: string;
  y_axis?: string;
  group_by?: string;
  description: string;
  reason: string;
  priority?: number;
}

export interface GeminiResponse {
  visualizations: VisualizationSuggestion[];
  insights?: string[];
  theme_suggestion?: {
    domain: string;
    primary_color: string;
    secondary_color: string;
  };
}

// Theme types
export interface Theme {
  name: string;
  domain: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    chart_palette: string[];
  };
}

// Filter types
export interface FilterConfig {
  column: string;
  type: 'range' | 'select' | 'multiselect' | 'date_range';
  values?: (string | number)[];
  min?: number | string;
  max?: number | string;
  selected?: any;
}

// Chart component props
export interface ChartCardProps {
  visualization: VisualizationSuggestion;
  data: Record<string, any>[];
  theme: Theme;
  size?: 'small' | 'medium' | 'large';
  onExport?: () => void;
  onEdit?: () => void;
  disableAnimation?: boolean;
  onPointClick?: (payload: any) => void;
}

// Dashboard state
export interface DashboardState {
  dataset: DatasetProfile | null;
  visualizations: VisualizationSuggestion[];
  filters: FilterConfig[];
  theme: Theme;
  loading: boolean;
  error: string | null;
}

// API types
export interface UploadDatasetResponse {
  profile: DatasetProfile;
  suggestions: GeminiResponse;
}
