import type { VercelRequest, VercelResponse } from '@vercel/node';

type DatasetColumn = {
  name: string;
  type: 'string' | 'integer' | 'float' | 'date' | 'boolean';
};

type DatasetProfile = {
  dataset_name: string;
  columns: DatasetColumn[];
  total_rows: number;
};

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) {
    res.status(200).json({ content: fallbackReport(req.body) });
    return;
  }

  try {
    const { datasetProfile, filteredData, insights } = req.body as {
      datasetProfile: DatasetProfile;
      filteredData: any[];
      insights: string[];
    };

    const { dataset_name, columns, total_rows } = datasetProfile;

    const numericColumns = columns.filter((c) => c.type === 'integer' || c.type === 'float');
    const categoricalColumns = columns.filter((c) => c.type === 'string');
    const dateColumns = columns.filter((c) => c.type === 'date');

    const sampleStats = numericColumns
      .slice(0, 3)
      .map((col) => {
        const values = filteredData
          .map((row: any) => parseFloat(row[col.name]))
          .filter((v: number) => !isNaN(v));
        if (values.length === 0) return null;
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const sorted = values.sort((a, b) => a - b);
        const median =
          sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const variance =
          values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        return {
          column: col.name,
          mean: mean.toFixed(2),
          median: median.toFixed(2),
          min,
          max,
          stdDev: stdDev.toFixed(2),
          count: values.length,
        };
      })
      .filter(Boolean);

    const prompt = `You are a senior data analyst with expertise in business intelligence and statistical analysis. 
Analyze the provided dataset and generate a comprehensive, professional data analysis report.

DATASET OVERVIEW:
- Name: "${dataset_name}"
- Total Records: ${total_rows}
- Filtered Records: ${filteredData.length}
- Numeric Columns: ${numericColumns.map((c) => c.name).join(', ')}
- Categorical Columns: ${categoricalColumns.map((c) => c.name).join(', ')}
- Date Columns: ${dateColumns.map((c) => c.name).join(', ')}

STATISTICAL SUMMARY:
${sampleStats
  .filter((stat) => stat !== null)
  .map(
    (stat: any) =>
      `${stat.column}: Mean=${stat.mean}, Median=${stat.median}, Range=[${stat.min}-${stat.max}], StdDev=${stat.stdDev}`
  )
  .join('\n')}

DATA SAMPLE (first 5 records):
${JSON.stringify(filteredData.slice(0, 5), null, 2)}

CURRENT INSIGHTS:
${(insights || []).join('\n- ')}

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

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }]}],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      res.status(200).json({ content: fallbackReport({ datasetProfile, filteredData, insights }) });
      return;
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      res.status(200).json({ content: fallbackReport({ datasetProfile, filteredData, insights }) });
      return;
    }

    res.status(200).json({ content: generatedText });
  } catch (e) {
    res.status(200).json({ content: fallbackReport(req.body) });
  }
}

function fallbackReport(input: any): string {
  try {
    const { datasetProfile, filteredData, insights } = input as {
      datasetProfile: DatasetProfile;
      filteredData: any[];
      insights: string[];
    };
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
${(insights || []).length > 0 ? (insights || []).map((insight) => `- ${insight}`).join('\n') : '- Analysis indicates standard data distribution patterns'}

## Recommendations
- Consider additional data collection to enhance analytical depth
- Implement regular monitoring for key metrics identified
- Explore relationships between categorical and numeric variables

## Technical Notes
- This analysis was generated automatically based on available data
- For deeper insights, consider consulting with a data analyst
- Regular data quality checks recommended`;
  } catch {
    return '# Data Analysis Report\n\nReport unavailable.';
  }
}


