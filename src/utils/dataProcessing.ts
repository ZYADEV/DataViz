import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DatasetProfile, DatasetColumn } from '../types';

// Parse CSV data and generate dataset profile
export const parseCSVFile = (file: File): Promise<DatasetProfile> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        try {
          const profile = generateDatasetProfile(results.data as Record<string, any>[], file.name);
          resolve(profile);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
};

// Parse Excel (xlsx/xls) data and generate dataset profile
export const parseExcelFile = (file: File): Promise<DatasetProfile> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true });
        const profile = generateDatasetProfile(json, file.name);
        resolve(profile);
      } catch (err: any) {
        reject(new Error(`Excel parsing failed: ${err?.message || String(err)}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.readAsArrayBuffer(file);
  });
};

// Unified parser that detects file type and parses accordingly
export const parseDataFile = (file: File): Promise<DatasetProfile> => {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    return parseCSVFile(file);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseExcelFile(file);
  }
  return Promise.reject(new Error('Unsupported file type. Please upload a CSV or Excel file.'));
};

// Parse JSON text into array of flat records
const flattenObject = (obj: any, prefix = '', out: Record<string, any> = {}, depth = 0): Record<string, any> => {
  if (obj === null || typeof obj !== 'object' || depth > 3) {
    out[prefix || 'value'] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flattenObject(v, key, out, depth + 1);
    } else {
      out[key] = v;
    }
  }
  return out;
};

const parseJSONText = (text: string, name = 'api.json'): DatasetProfile => {
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error('Invalid JSON from URL'); }
  let rows: any[] | null = null;
  if (Array.isArray(json)) rows = json;
  if (!rows) {
    // Find first array of objects in the object tree
    const scan = (obj: any): any[] | null => {
      if (!obj || typeof obj !== 'object') return null;
      for (const v of Object.values(obj)) {
        if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v as any[];
        if (typeof v === 'object') {
          const r = scan(v);
          if (r) return r;
        }
      }
      return null;
    };
    rows = scan(json);
  }
  if (!rows) throw new Error('No tabular array found in JSON');
  const flat = rows.map((r) => (typeof r === 'object' ? flattenObject(r) : { value: r }));
  return generateDatasetProfile(flat, name);
};

// Fetch and parse from URL (CSV, JSON, XLSX) with best-effort detection
export const parseFromUrl = async (url: string): Promise<DatasetProfile> => {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to fetch ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  const lowerUrl = url.toLowerCase();
  if (contentType.includes('application/json') || lowerUrl.endsWith('.json')) {
    const text = await res.text();
    return parseJSONText(text, url.split('/').pop() || 'api.json');
  }
  if (contentType.includes('text/csv') || lowerUrl.endsWith('.csv')) {
    const text = await res.text();
    // Build a File-like object for existing parser
    const file = new File([text], 'remote.csv', { type: 'text/csv' });
    return parseCSVFile(file);
  }
  if (lowerUrl.endsWith('.xlsx') || lowerUrl.endsWith('.xls') || contentType.includes('spreadsheet')) {
    const blob = await res.blob();
    const file = new File([blob], 'remote.xlsx', { type: blob.type });
    return parseExcelFile(file);
  }
  // Fallback: try JSON text, then CSV
  const fallbackText = await res.text();
  try { return parseJSONText(fallbackText, 'api.json'); } catch {}
  const file = new File([fallbackText], 'remote.csv', { type: 'text/csv' });
  return parseCSVFile(file);
};

// Generate dataset profile from raw data
export const generateDatasetProfile = (
  data: Record<string, any>[],
  datasetName: string
): DatasetProfile => {
  if (!data || data.length === 0) {
    throw new Error('Dataset is empty or invalid');
  }

  // Normalize/sanitize column names and drop empty-only columns
  const firstRow = data[0];
  const rawColumnNames = Object.keys(firstRow);

  // Build a map oldName -> sanitizedName
  const nameMap = new Map<string, string>();
  let colCounter = 1;
  const sanitize = (name: string) => {
    const trimmed = String(name || '').trim();
    const invalid = trimmed === '' || /^_+\d+$/.test(trimmed) || /^__?EMPTY.*$/i.test(trimmed);
    let candidate = invalid ? `Column_${colCounter++}` : trimmed;
    // Avoid duplicates
    let suffix = 1;
  const existing = Array.from(nameMap.values());
  while (existing.includes(candidate)) {
      candidate = `${candidate}_${suffix++}`;
    }
    return candidate;
  };

  rawColumnNames.forEach((n) => nameMap.set(n, sanitize(n)));

  // Create a cleaned dataset with sanitized keys and filter out columns that are entirely empty
  const cleanedData: Record<string, any>[] = data.map((row) => {
    const newRow: Record<string, any> = {};
    for (const orig of rawColumnNames) {
      const newKey = nameMap.get(orig)!;
      let val = row[orig];
      if (val === null || val === undefined) {
        newRow[newKey] = '';
        continue;
      }
      // Normalize numbers if string with thousand separators or commas
      if (typeof val === 'string') {
        const trimmed = val.trim();
        // Strict numeric patterns: either 123,456 or 123.45
        const thousandsPattern = /^[+-]?\d{1,3}(?:[ ,]\d{3})+(?:\.\d+)?$/;
        const simpleNumericPattern = /^[+-]?\d+(?:\.\d+)?$/;
        if (thousandsPattern.test(trimmed)) {
          const normalized = trimmed.replace(/[,\s]/g, '');
          const parsed = Number(normalized);
          if (!Number.isNaN(parsed)) val = parsed;
          else val = trimmed;
        } else if (simpleNumericPattern.test(trimmed)) {
          const parsed = Number(trimmed);
          if (!Number.isNaN(parsed)) val = parsed;
          else val = trimmed;
        } else {
          val = trimmed;
        }
      }
      newRow[newKey] = val;
    }
    return newRow;
  });

  // Determine which columns are not entirely empty
  const nonEmptyColumns = Array.from(nameMap.values()).filter((col) => {
    return cleanedData.some((r) => r[col] !== null && r[col] !== undefined && r[col] !== '');
  });

  const columns: DatasetColumn[] = nonEmptyColumns.map((columnName) => {
    const columnData = cleanedData
      .map((row) => row[columnName])
      .filter((val) => val !== null && val !== undefined && val !== '');

    return analyzeColumn(columnName, columnData);
  });

  // Get representative sample (first 10 rows)
  const sampleRows = cleanedData.slice(0, 10);

  return {
    dataset_name: datasetName.replace(/\.[^/.]+$/, ''), // Remove file extension
    columns,
    sample_rows: sampleRows,
    rows: cleanedData,
    total_rows: cleanedData.length,
  };
};

// Analyze a single column to determine its type and characteristics
const analyzeColumn = (name: string, values: any[]): DatasetColumn => {
  if (values.length === 0) {
    return {
      name,
      type: 'string',
      unique_values: 0,
    };
  }

  const uniqueValues = new Set(values);
  const nonEmptyValues = values.filter(val => val !== null && val !== undefined && val !== '');

  // Type detection with heuristics (dates, numbers, booleans)
  const type = detectColumnType(nonEmptyValues);

  const column: DatasetColumn = {
    name,
    type,
    unique_values: uniqueValues.size,
    sample_values: Array.from(uniqueValues).slice(0, 5),
  };

  // Add min/max for numeric and date columns
  if (type === 'integer' || type === 'float') {
    const numericValues = nonEmptyValues.map(val => parseFloat(val)).filter(val => !isNaN(val));
    if (numericValues.length > 0) {
      column.min = Math.min(...numericValues);
      column.max = Math.max(...numericValues);
    }
  } else if (type === 'date') {
    const dateValues = nonEmptyValues.map(val => new Date(val)).filter(date => !isNaN(date.getTime()));
    if (dateValues.length > 0) {
      column.min = new Date(Math.min(...dateValues.map(d => d.getTime()))).toISOString();
      column.max = new Date(Math.max(...dateValues.map(d => d.getTime()))).toISOString();
    }
  }

  return column;
};

// Detect column data type
const detectColumnType = (values: any[]): DatasetColumn['type'] => {
  if (values.length === 0) return 'string';

  let numericCount = 0;
  let integerCount = 0;
  let dateCount = 0;
  let booleanCount = 0;

  for (const value of values) {
    const stringValue = String(value).toLowerCase().trim();

    // Check boolean
    if (['true', 'false', '1', '0', 'yes', 'no'].includes(stringValue)) {
      booleanCount++;
      continue;
    }

    // Check numeric
    const thousandsPattern = /^[+-]?\d{1,3}(?:[ ,]\d{3})+(?:\.\d+)?$/;
    const simpleNumericPattern = /^[+-]?\d+(?:\.\d+)?$/;
    if (thousandsPattern.test(stringValue) || simpleNumericPattern.test(stringValue)) {
      const normalized = stringValue.replace(/[,\s]/g, '');
      const numericValue = Number(normalized);
      if (!isNaN(numericValue) && isFinite(numericValue)) {
        numericCount++;
        if (Number.isInteger(numericValue)) integerCount++;
        continue;
      }
    }

    // Check date
    const dateValue = new Date(stringValue);
    if (!isNaN(dateValue.getTime()) && stringValue.length > 4) {
      dateCount++;
      continue;
    }
  }

  const total = values.length;
  const threshold = 0.8; // 80% of values must match type

  if (booleanCount / total >= threshold) return 'boolean';
  if (dateCount / total >= threshold) return 'date';
  if (numericCount / total >= threshold) {
    return integerCount / numericCount >= 0.9 ? 'integer' : 'float';
  }

  return 'string';
};

// Filter data based on filter configurations
export const applyFilters = (
  data: Record<string, any>[],
  filters: { column: string; values?: any[]; min?: any; max?: any }[]
): Record<string, any>[] => {
  return data.filter((row) => {
    return filters.every((filter) => {
      const rawValue = row[filter.column];

      // Discrete include values
      if (filter.values && filter.values.length > 0) {
        return filter.values.includes(rawValue);
      }

      // Range filtering (numeric or date)
      if (filter.min !== undefined && filter.max !== undefined) {
        const minVal = filter.min;
        const maxVal = filter.max;

        // Try numeric compare first
        const num = parseFloat(rawValue);
        const minNum = typeof minVal === 'number' ? minVal : parseFloat(minVal);
        const maxNum = typeof maxVal === 'number' ? maxVal : parseFloat(maxVal);
        const bothNumeric = !isNaN(num) && !isNaN(minNum) && !isNaN(maxNum);

        if (bothNumeric) {
          return num >= minNum && num <= maxNum;
        }

        // Try date compare
        const valTime = Date.parse(rawValue);
        const minTime = typeof minVal === 'string' ? Date.parse(minVal) : Number(minVal);
        const maxTime = typeof maxVal === 'string' ? Date.parse(maxVal) : Number(maxVal);
        if (!isNaN(valTime) && !isNaN(minTime) && !isNaN(maxTime)) {
          return valTime >= minTime && valTime <= maxTime;
        }
      }

      return true;
    });
  });
};

// Get unique values for a column (for filter options)
export const getUniqueValues = (data: Record<string, any>[], column: string): any[] => {
  const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined && val !== '');
  return Array.from(new Set(values)).sort();
};

// Generate summary statistics for numeric columns
export const generateColumnStats = (data: Record<string, any>[], column: string) => {
  const values = data.map(row => parseFloat(row[column])).filter(val => !isNaN(val));

  if (values.length === 0) {
    return { count: 0, mean: 0, median: 0, std: 0, min: 0, max: 0 };
  }

  const sorted = values.sort((a, b) => a - b);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);

  return {
    count: values.length,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    std: Math.round(std * 100) / 100,
    min: Math.min(...values),
    max: Math.max(...values),
  };
};
