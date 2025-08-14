// Avoiding '@vercel/node' type import to prevent missing type errors in build

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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if ((req.method || '').toUpperCase() === 'OPTIONS') { res.status(200).end(); return; }
  if ((req.method || '').toUpperCase() !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const profile: DatasetProfile = await readJsonBody(req);
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
    if (!response.ok) {
      const text = await response.text();
      console.error('Gemini rename HTTP error:', response.status, response.statusText, text);
      res.status(200).json({});
      return;
    }
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

async function readJsonBody(req: any): Promise<any> {
  try {
    if (req.body) {
      if (typeof req.body === 'string') return JSON.parse(req.body);
      return req.body;
    }
    const chunks: any[] = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}


