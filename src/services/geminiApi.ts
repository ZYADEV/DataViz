import { DatasetProfile, GeminiResponse, VisualizationSuggestion } from '../types';

const GEMINI_API_KEY = (import.meta as any).env?.VITE_GEMINI_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const API_BASE: string = ((import.meta as any).env?.VITE_API_BASE || '').replace(/\/$/, '');

// Generate visualization suggestions - uses direct API in dev, serverless in production
export const generateVisualizationSuggestions = async (
  datasetProfile: DatasetProfile
): Promise<GeminiResponse> => {
  // Use direct Gemini API for local development only
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (GEMINI_API_KEY && isLocal) {
    console.log('Using direct Gemini API for local development');
    return generateVisualizationSuggestionsDirectly(datasetProfile);
  }
  
  // Use serverless API for production
  try {
    console.log('Using serverless API for production');
    const minimalProfile = minifyProfileForAI(datasetProfile);
    const response = await fetch(`/api/gemini/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(minimalProfile),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Suggestions API error:', response.status, response.statusText, errorText);
      throw new Error(`Suggestions API failed: ${response.status} ${response.statusText}`);
    }
    const json = await response.json();
    return json as GeminiResponse;
  } catch (error) {
    console.error('Error fetching AI suggestions:', error);
    console.log('Using fallback suggestions due to API error');
    return generateFallbackSuggestions(datasetProfile);
  }
};

// Direct Gemini API call for local development
async function generateVisualizationSuggestionsDirectly(datasetProfile: DatasetProfile): Promise<GeminiResponse> {
  const prompt = createGeminiPrompt(datasetProfile);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No response generated from Gemini API');
    }

    // Parse the JSON response from Gemini
    let parsedResponse: any;
    try {
      // Try fenced JSON first
      const fenced = generatedText.match(/```json\s*([\s\S]*?)\s*```/);
      if (fenced) {
        parsedResponse = JSON.parse(fenced[1]);
      } else {
        // Try plain JSON
        const plain = generatedText.trim();
        parsedResponse = JSON.parse(plain);
      }
    } catch (e) {
      throw new Error('No valid JSON found in Gemini response');
    }

    // Validate and enhance the response
    return enhanceGeminiResponse(parsedResponse, datasetProfile);
  } catch (error) {
    console.error('Error calling Gemini API directly:', error);
    return generateFallbackSuggestions(datasetProfile);
  }
}

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

  // Use direct Gemini API for local development
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (GEMINI_API_KEY && isLocal) {
    return suggestColumnNamesDirectly(datasetProfile, genericNames);
  }

  try {
    const minimalProfile = minifyProfileForAI(datasetProfile, 5);
    const response = await fetch(`/api/gemini/rename-columns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(minimalProfile),
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

// Direct column naming for local development
async function suggestColumnNamesDirectly(datasetProfile: DatasetProfile, genericNames: Set<string>): Promise<Record<string, string>> {
  const prompt = `You are a data cleaning assistant. Propose human-friendly column names for the given dataset.
Return ONLY a JSON object mapping from current_name to new_name. Keep names concise, in English, camel case or Title Case, no spaces at ends.
Preserve semantics based on sample values.

Dataset name: ${datasetProfile.dataset_name}
Columns: ${JSON.stringify(datasetProfile.columns, null, 2)}
Sample rows: ${JSON.stringify(datasetProfile.sample_rows.slice(0, 5), null, 2)}

Return JSON like: { "Column_1": "StationName", "Column_2": "Day", "Column_3": "RainfallMm" }`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }]}],
        generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
      }),
    });
    if (!response.ok) return {};
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return {};
    
    let json: any;
    try {
      const fenced = text.match(/```json\s*([\s\S]*?)\s*```/);
      json = fenced ? JSON.parse(fenced[1]) : JSON.parse(text);
    } catch {
      return {};
    }
    
    const mapping: Record<string, string> = {};
    Object.entries(json).forEach(([k, v]) => {
      if (typeof v === 'string' && genericNames.has(k)) {
        mapping[k] = v.trim().replace(/\s+/g, ' ');
      }
    });
    return mapping;
  } catch {
    return {};
  }
}

// Generate comprehensive AI analysis report
export const generateDataAnalysisReport = async (
  datasetProfile: DatasetProfile,
  filteredData: any[],
  insights: string[]
): Promise<string> => {
  // Use direct Gemini API for local development
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (GEMINI_API_KEY && isLocal) {
    return generateDataAnalysisReportDirectly(datasetProfile, filteredData, insights);
  }

  try {
    const minimalProfile = minifyProfileForAI(datasetProfile);
    const response = await fetch(`/api/gemini/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetProfile: minimalProfile, filteredData: filteredData.slice(0, 2000), insights: insights.slice(0, 100) }),
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

// Direct report generation for local development
async function generateDataAnalysisReportDirectly(
  datasetProfile: DatasetProfile,
  filteredData: any[],
  insights: string[]
): Promise<string> {
  const { dataset_name, columns, total_rows } = datasetProfile;
  
  // Calculate advanced statistics
  const numericColumns = columns.filter(c => c.type === 'integer' || c.type === 'float');
  const categoricalColumns = columns.filter(c => c.type === 'string');
  const dateColumns = columns.filter(c => c.type === 'date');
  
  // Get sample statistics
  const sampleStats = numericColumns.slice(0, 3).map(col => {
    const values = filteredData.map(row => parseFloat(row[col.name])).filter(v => !isNaN(v));
    if (values.length === 0) return null;
    
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const sorted = values.sort((a, b) => a - b);
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      column: col.name,
      mean: mean.toFixed(2),
      median: median.toFixed(2),
      min, max,
      stdDev: stdDev.toFixed(2),
      count: values.length
    };
  }).filter(Boolean);

  const prompt = `You are a senior data analyst with expertise in business intelligence and statistical analysis. 
Analyze the provided dataset and generate a comprehensive, professional data analysis report.

DATASET OVERVIEW:
- Name: "${dataset_name}"
- Total Records: ${total_rows}
- Filtered Records: ${filteredData.length}
- Numeric Columns: ${numericColumns.map(c => c.name).join(', ')}
- Categorical Columns: ${categoricalColumns.map(c => c.name).join(', ')}
- Date Columns: ${dateColumns.map(c => c.name).join(', ')}

STATISTICAL SUMMARY:
${sampleStats.filter(stat => stat !== null).map(stat => 
  `${stat!.column}: Mean=${stat!.mean}, Median=${stat!.median}, Range=[${stat!.min}-${stat!.max}], StdDev=${stat!.stdDev}`
).join('\n')}

DATA SAMPLE (first 5 records):
${JSON.stringify(filteredData.slice(0, 5), null, 2)}

CURRENT INSIGHTS:
${insights.join('\n- ')}

Please provide a comprehensive analysis report with the following structure:

## Executive Summary
- Brief overview of the dataset and key findings
- 3-4 bullet points of the most important insights

## Data Overview
- Dataset characteristics and structure
- Data quality assessment
- Any notable patterns or anomalies

## Key Findings
- Statistical insights and trends
- Correlations and relationships
- Business implications

## Recommendations
- Actionable recommendations based on the analysis
- Areas for further investigation
- Potential business decisions supported by the data

## Technical Notes
- Data limitations or caveats
- Suggested additional analyses

Format the response in clean markdown with clear sections. Be professional, insightful, and focus on business value. 
Keep the total length to approximately 2 pages when printed. Use specific numbers and examples from the data.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No response generated from Gemini API');
    }

    return generatedText;
  } catch (error) {
    console.error('Error generating AI analysis report:', error);
    
    // Fallback report
    return `# Data Analysis Report: ${dataset_name}

## Executive Summary
- Dataset contains ${total_rows} records across ${columns.length} columns
- ${numericColumns.length} numeric columns available for statistical analysis
- ${categoricalColumns.length} categorical variables for segmentation
- Analysis based on ${filteredData.length} filtered records

## Data Overview
The dataset "${dataset_name}" provides a structured view of ${total_rows} records. The data includes:
- Numeric metrics: ${numericColumns.map(c => c.name).join(', ') || 'None identified'}
- Categorical dimensions: ${categoricalColumns.map(c => c.name).join(', ') || 'None identified'}
- Temporal data: ${dateColumns.map(c => c.name).join(', ') || 'None identified'}

## Key Findings
${insights.length > 0 ? insights.map(insight => `- ${insight}`).join('\n') : '- Analysis indicates standard data distribution patterns'}

## Recommendations
- Consider additional data collection to enhance analytical depth
- Implement regular monitoring for key metrics identified
- Explore relationships between categorical and numeric variables

## Technical Notes
- This analysis was generated automatically based on available data
- For deeper insights, consider consulting with a data analyst
- Regular data quality checks recommended`;
  }
}

// Create a structured prompt for Gemini
const createGeminiPrompt = (profile: DatasetProfile): string => {
  const { dataset_name, columns, sample_rows, total_rows } = profile;

  return `You are a professional data visualization assistant. Analyze the following dataset and suggest the most relevant and insightful visualizations.

Dataset Profile:
- Name: "${dataset_name}"
- Total Rows: ${total_rows}
- Columns: ${JSON.stringify(columns, null, 2)}
- Sample Data: ${JSON.stringify(sample_rows, null, 2)}

Guidelines:
1. Suggest 3-6 diverse visualization types that best reveal insights in this data
2. Consider data types, relationships, and patterns
3. Prioritize visualizations that show trends, comparisons, distributions, or correlations
4. Include at least one KPI if numeric data exists
5. Suggest appropriate chart types: bar, line, pie, scatter, area, histogram, heatmap, KPI
6. For each suggestion, specify which columns to use for x_axis, y_axis, and optional group_by
7. Provide clear descriptions and reasoning

Additional Context:
- Look for temporal patterns if date columns exist
- Consider categorical breakdowns for string columns
- Identify key metrics for KPI cards
- Suggest grouping by categorical variables when meaningful

Return your response in this exact JSON format:
{
  "visualizations": [
    {
      "chart_type": "line|bar|pie|scatter|area|histogram|heatmap|KPI",
      "x_axis": "column_name",
      "y_axis": "column_name (optional for pie/KPI)",
      "group_by": "column_name (optional)",
      "description": "Brief description of what this chart shows",
      "reason": "Why this visualization is valuable for this dataset",
      "priority": 1-5
    }
  ],
  "insights": [
    "Key insight about the data",
    "Another notable pattern or trend"
  ],
  "theme_suggestion": {
    "domain": "suggested domain category",
    "primary_color": "#hex_color",
    "secondary_color": "#hex_color"
  }
}

Focus on actionable insights and ensure all suggested columns exist in the dataset.`;
};

function minifyProfileForAI(profile: DatasetProfile, sampleRows: number = 20): DatasetProfile {
  return {
    dataset_name: profile.dataset_name,
    domain: profile.domain,
    total_rows: profile.total_rows,
    columns: profile.columns.map((c) => ({
      name: c.name,
      type: c.type,
      unique_values: c.unique_values,
      min: c.min,
      max: c.max,
      sample_values: c.sample_values,
    })),
    sample_rows: (profile.sample_rows || []).slice(0, sampleRows),
  } as unknown as DatasetProfile;
}

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
