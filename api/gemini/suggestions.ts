// Using untyped request/response to avoid requiring '@vercel/node' types at build time

type DatasetColumn = {
  name: string;
  type: 'string' | 'integer' | 'float' | 'date' | 'boolean';
  unique_values: number;
  min?: number | string;
  max?: number | string;
};

type DatasetProfile = {
  dataset_name: string;
  domain?: string;
  columns: DatasetColumn[];
  sample_rows: Record<string, any>[];
  total_rows: number;
};

type VisualizationSuggestion = {
  chart_type: 'bar' | 'line' | 'pie' | 'scatter' | 'KPI' | 'heatmap' | 'map' | 'area' | 'histogram';
  x_axis: string;
  y_axis?: string;
  group_by?: string;
  description: string;
  reason: string;
  priority?: number;
};

type GeminiResponse = {
  visualizations: VisualizationSuggestion[];
  insights?: string[];
  theme_suggestion?: {
    domain: string;
    primary_color: string;
    secondary_color: string;
  };
};

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function createGeminiPrompt(profile: DatasetProfile): string {
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
}

function enhanceGeminiResponse(response: any, profile: DatasetProfile): GeminiResponse {
  const validColumns = profile.columns.map((col) => col.name);
  const validVisualizations = (response.visualizations || [])
    .filter((viz: any) => {
      if (!viz.chart_type || !viz.x_axis) return false;
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
      priority: viz.priority || index + 1,
    }))
    .sort((a: any, b: any) => (a.priority || 999) - (b.priority || 999));

  return {
    visualizations: validVisualizations,
    insights: response.insights || [],
    theme_suggestion: response.theme_suggestion,
  };
}

function generateFallbackSuggestions(profile: DatasetProfile): GeminiResponse {
  const suggestions: VisualizationSuggestion[] = [];
  const { columns } = profile;

  const numericColumns = columns.filter((c) => c.type === 'integer' || c.type === 'float');
  const categoricalColumns = columns.filter((c) => c.type === 'string');
  const dateColumns = columns.filter((c) => c.type === 'date');

  const pickCategory = () => {
    const sorted = [...categoricalColumns]
      .filter((c) => !/^Column_/i.test(c.name))
      .sort((a, b) => a.unique_values - b.unique_values);
    return (
      sorted.find((c) => c.unique_values > 1 && c.unique_values <= 20) ||
      sorted[0] ||
      categoricalColumns[0]
    );
  };

  if (numericColumns.length > 0) {
    suggestions.push({
      chart_type: 'KPI',
      x_axis: numericColumns[0].name,
      description: `Average ${numericColumns[0].name}`,
      reason: 'Quick overview of a key numeric metric',
      priority: 1,
    });
  }

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

  if (numericColumns.length > 0) {
    suggestions.push({
      chart_type: 'area',
      x_axis: numericColumns[0].name,
      description: `Distribution of ${numericColumns[0].name}`,
      reason: 'Highlights distribution shape',
      priority: 4,
    });
  }

  if (numericColumns.length > 0) {
    suggestions.push({
      chart_type: 'histogram',
      x_axis: numericColumns[0].name,
      description: `Histogram of ${numericColumns[0].name}`,
      reason: 'Shows frequency distribution',
      priority: 4,
    });
  }

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
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_KEY;
  const profile = req.body as DatasetProfile;

  if (!profile || !profile.dataset_name || !Array.isArray(profile.columns)) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  if (!apiKey) {
    // No key configured, return safe fallback so the app still works
    const fallback = generateFallbackSuggestions(profile);
    res.status(200).json(fallback);
    return;
  }

  try {
    const prompt = createGeminiPrompt(profile);

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }]}],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${text}`);
    }

    const data = await response.json();
    const generatedText: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No response generated from Gemini API');
    }

    let parsedResponse: any;
    try {
      const fenced = generatedText.match(/```json\s*([\s\S]*?)\s*```/);
      if (fenced) {
        parsedResponse = JSON.parse(fenced[1]);
      } else {
        const plain = generatedText.trim();
        parsedResponse = JSON.parse(plain);
      }
    } catch {
      // If the model didn't return JSON, use fallback
      const fallback = generateFallbackSuggestions(profile);
      res.status(200).json(fallback);
      return;
    }

    const enhanced = enhanceGeminiResponse(parsedResponse, profile);
    res.status(200).json(enhanced);
  } catch (error: any) {
    console.error('Error in /api/gemini/suggestions:', error);
    const fallback = generateFallbackSuggestions(profile);
    res.status(200).json(fallback);
  }
}


