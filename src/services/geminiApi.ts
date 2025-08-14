import { DatasetProfile, GeminiResponse, VisualizationSuggestion } from '../types';

// Generate visualization suggestions via secure serverless API
export const generateVisualizationSuggestions = async (
  datasetProfile: DatasetProfile
): Promise<GeminiResponse> => {
  try {
    const response = await fetch('/api/gemini/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datasetProfile),
    });
    if (!response.ok) throw new Error('Suggestions API failed');
    const json = await response.json();
    return json as GeminiResponse;
  } catch (error) {
    console.error('Error fetching AI suggestions:', error);
    return generateFallbackSuggestions(datasetProfile);
  }
};

// Suggest better column names mapping using Gemini
export const suggestColumnNames = async (
  datasetProfile: DatasetProfile
): Promise<Record<string, string>> => {
  const genericNames = new Set(
    datasetProfile.columns
      .filter((c) => /^Column_/i.test(c.name) || /__?EMPTY/i.test(c.name))
      .map((c) => c.name)
  );
  if (genericNames.size === 0) return {};

  try {
    const response = await fetch('/api/gemini/rename-columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datasetProfile),
    });
    if (!response.ok) return {};
    const mapping = (await response.json()) as Record<string, string>;
    const filtered: Record<string, string> = {};
    Object.entries(mapping).forEach(([k, v]) => {
      if (typeof v === 'string' && genericNames.has(k)) {
        filtered[k] = v.trim().replace(/\s+/g, ' ');
      }
    });
    return filtered;
  } catch {
    return {};
  }
};

// Generate comprehensive AI analysis report
export const generateDataAnalysisReport = async (
  datasetProfile: DatasetProfile,
  filteredData: any[],
  insights: string[]
): Promise<string> => {
  try {
    const response = await fetch('/api/gemini/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetProfile, filteredData, insights }),
    });
    if (!response.ok) throw new Error('Report API failed');
    const data = await response.json();
    return String(data.content || '');
  } catch (error) {
    console.error('Error generating AI analysis report:', error);
    const { dataset_name, columns, total_rows } = datasetProfile;
    const numericColumns = columns.filter((c) => c.type === 'integer' || c.type === 'float');
    const categoricalColumns = columns.filter((c) => c.type === 'string');
    return `# Data Analysis Report: ${dataset_name}

## Executive Summary
- Dataset contains ${total_rows} records across ${columns.length} columns
- ${numericColumns.length} numeric columns available for statistical analysis
- ${categoricalColumns.length} categorical variables for segmentation
- Analysis based on ${filteredData.length} filtered records

## Data Overview
The dataset "${dataset_name}" provides a structured view of ${total_rows} records. The data includes:
- Numeric metrics: ${numericColumns.map((c) => c.name).join(', ') || 'None identified'}
- Categorical dimensions: ${categoricalColumns.map((c) => c.name).join(', ') || 'None identified'}
- Temporal data: ${(columns.filter((c) => c.type === 'date').map((c) => c.name).join(', ')) || 'None identified'}

## Key Findings
${insights.length > 0 ? insights.map((insight) => `- ${insight}`).join('\n') : '- Analysis indicates standard data distribution patterns'}

## Recommendations
- Consider additional data collection to enhance analytical depth
- Implement regular monitoring for key metrics identified
- Explore relationships between categorical and numeric variables

## Technical Notes
- This analysis was generated automatically based on available data
- For deeper insights, consider consulting with a data analyst
- Regular data quality checks recommended`;
  }
};

// Note: prompt generation moved server-side
const createGeminiPrompt = (_profile: DatasetProfile): string => '';

// Enhance and validate Gemini response
const enhanceGeminiResponse = (
  response: any,
  profile: DatasetProfile
): GeminiResponse => {
  const validColumns = profile.columns.map(col => col.name);

  // Filter and validate visualizations
  const validVisualizations = (response.visualizations || [])
    .filter((viz: any) => {
      // Ensure required fields exist
      if (!viz.chart_type || !viz.x_axis) return false;

      // Validate column references
      if (!validColumns.includes(viz.x_axis)) return false;
      if (viz.y_axis && !validColumns.includes(viz.y_axis)) return false;
      if (viz.group_by && !validColumns.includes(viz.group_by)) return false;

      return true;
    })
    .map((viz: any, index: number) => ({
      chart_type: viz.chart_type,
      x_axis: viz.x_axis,
      y_axis: viz.y_axis,
      group_by: viz.group_by,
      description: viz.description || `${viz.chart_type} chart`,
      reason: viz.reason || 'Provides insight into the data',
      priority: viz.priority || (index + 1),
    }))
    .sort((a: any, b: any) => (a.priority || 999) - (b.priority || 999));

  return {
    visualizations: validVisualizations,
    insights: response.insights || [],
    theme_suggestion: response.theme_suggestion,
  };
};

// Generate fallback suggestions using rule-based logic
const generateFallbackSuggestions = (profile: DatasetProfile): GeminiResponse => {
  const suggestions: VisualizationSuggestion[] = [];
  const { columns } = profile;

  const numericColumns = columns.filter((c) => (c.type === 'integer' || c.type === 'float'));
  const categoricalColumns = columns.filter((c) => c.type === 'string');
  const dateColumns = columns.filter((c) => c.type === 'date');

  // Helper to pick the most meaningful categorical (not too sparse, not auto-generated)
  const pickCategory = () => {
    const sorted = [...categoricalColumns]
      .filter((c) => !/^Column_/i.test(c.name))
      .sort((a, b) => a.unique_values - b.unique_values);
    return sorted.find((c) => c.unique_values > 1 && c.unique_values <= 20) || sorted[0] || categoricalColumns[0];
  };

  // 1) KPI if numeric exists
  if (numericColumns.length > 0) {
    suggestions.push({
      chart_type: 'KPI',
      x_axis: numericColumns[0].name,
      description: `Average ${numericColumns[0].name}`,
      reason: 'Quick overview of a key numeric metric',
      priority: 1,
    });
  }

  // 2) Time series if date + numeric exists
  if (dateColumns.length > 0 && numericColumns.length > 0) {
    suggestions.push({
      chart_type: 'line',
      x_axis: dateColumns[0].name,
      y_axis: numericColumns[0].name,
      group_by: pickCategory()?.name,
      description: `${numericColumns[0].name} over time`,
      reason: 'Shows trends across dates',
      priority: 2,
    });
  }

  // 3) Top-N categories by a numeric metric (bar)
  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    const cat = pickCategory();
    suggestions.push({
      chart_type: 'bar',
      x_axis: cat.name,
      y_axis: numericColumns[0].name,
      description: `Top ${cat.name} by ${numericColumns[0].name}`,
      reason: 'Compares categories by value; aggregate top-N client-side',
      priority: 3,
    });
  }

  // 4) Distribution of a numeric metric (area)
  if (numericColumns.length > 0) {
    suggestions.push({
      chart_type: 'area',
      x_axis: numericColumns[0].name,
      description: `Distribution of ${numericColumns[0].name}`,
      reason: 'Highlights distribution shape',
      priority: 4,
    });
  }

  // 4b) Histogram for numeric distribution
  if (numericColumns.length > 0) {
    suggestions.push({
      chart_type: 'histogram',
      x_axis: numericColumns[0].name,
      description: `Histogram of ${numericColumns[0].name}`,
      reason: 'Shows frequency distribution',
      priority: 4,
    });
  }

  // 5) Scatter for relationship between two numeric metrics
  if (numericColumns.length >= 2) {
    suggestions.push({
      chart_type: 'scatter',
      x_axis: numericColumns[0].name,
      y_axis: numericColumns[1].name,
      group_by: pickCategory()?.name,
      description: `Relationship: ${numericColumns[0].name} vs ${numericColumns[1].name}`,
      reason: 'Potential correlation',
      priority: 5,
    });
  }

  // Deduplicate by chart_type and description to avoid repetitive plots
  const added = new Set<string>();
  const deduped = suggestions.filter((s) => {
    const key = `${s.chart_type}|${s.x_axis}|${s.y_axis || ''}|${s.group_by || ''}`;
    if (added.has(key)) return false;
    added.add(key);
    return true;
  });

  return {
    visualizations: deduped.slice(0, 5),
    insights: ['Generated using fallback analysis'],
    theme_suggestion: {
      domain: 'generic',
      primary_color: '#00BFA6',
      secondary_color: '#FF6B6B',
    },
  };
};
