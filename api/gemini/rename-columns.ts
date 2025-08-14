import type { VercelRequest, VercelResponse } from '@vercel/node';

type DatasetColumn = {
  name: string;
  type: 'string' | 'integer' | 'float' | 'date' | 'boolean';
  unique_values: number;
  sample_values?: (string | number)[];
};

type DatasetProfile = {
  dataset_name: string;
  domain?: string;
  columns: DatasetColumn[];
  sample_rows: Record<string, any>[];
  total_rows: number;
};

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const profile = req.body as DatasetProfile;
  if (!profile || !Array.isArray(profile.columns)) {
    res.status(400).json({ error: 'Invalid body' });
    return;
  }

  const genericNames = new Set(
    profile.columns
      .filter((c) => /^Column_/i.test(c.name) || /__?EMPTY/i.test(c.name))
      .map((c) => c.name)
  );
  if (genericNames.size === 0) {
    res.status(200).json({});
    return;
  }

  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) {
    res.status(200).json({});
    return;
  }

  const prompt = `You are a data cleaning assistant. Propose human-friendly column names for the given dataset.
Return ONLY a JSON object mapping from current_name to new_name. Keep names concise, in English, camel case or Title Case, no spaces at ends.
Preserve semantics based on sample values.

Dataset name: ${profile.dataset_name}
Columns: ${JSON.stringify(profile.columns, null, 2)}
Sample rows: ${JSON.stringify(profile.sample_rows.slice(0, 5), null, 2)}

Return JSON like: { "Column_1": "StationName", "Column_2": "Day", "Column_3": "RainfallMm" }`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }]}],
        generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
      }),
    });
    if (!response.ok) throw new Error('Gemini name suggest failed');
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      res.status(200).json({});
      return;
    }
    let json: any;
    try {
      const fenced = text.match(/```json\s*([\s\S]*?)\s*```/);
      json = fenced ? JSON.parse(fenced[1]) : JSON.parse(text);
    } catch {
      res.status(200).json({});
      return;
    }
    const mapping: Record<string, string> = {};
    Object.entries(json).forEach(([k, v]) => {
      if (typeof v === 'string' && genericNames.has(k)) {
        mapping[k] = v.trim().replace(/\s+/g, ' ');
      }
    });
    res.status(200).json(mapping);
  } catch (e) {
    res.status(200).json({});
  }
}


