import { DatasetProfile } from '../types';

const parseYear = (val: any): number | null => {
  if (val == null) return null;
  const s = String(val);
  // pick first 4-digit year-like number
  const m = s.match(/(19|20)\d{2}/);
  if (m) return parseInt(m[0], 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.getFullYear();
  return null;
};

export interface LocalAnalyticsSummary {
  lines: string[];
}

export const computeLocalAnalytics = (
  profile: DatasetProfile,
  rows: Record<string, any>[]
): LocalAnalyticsSummary => {
  const lines: string[] = [];
  if (!rows.length) return { lines };

  const numericCols = profile.columns.filter((c) => c.type === 'integer' || c.type === 'float').map((c) => c.name);
  const catCols = profile.columns.filter((c) => c.type === 'string').map((c) => c.name);
  const dateCols = profile.columns.filter((c) => c.type === 'date' || /year|date|time|occurrence/i.test(c.name)).map((c) => c.name);

  // 1) YoY trend for the first date + numeric
  if (dateCols.length > 0 && numericCols.length > 0) {
    const dKey = dateCols[0];
    const nKey = numericCols[0];
    const perYear = new Map<number, number>();
    rows.forEach((r) => {
      const y = parseYear(r[dKey]);
      const v = Number(r[nKey]);
      if (y != null && !isNaN(v)) perYear.set(y, (perYear.get(y) || 0) + v);
    });
    const years = Array.from(perYear.keys()).sort((a, b) => a - b);
    if (years.length >= 2) {
      const latest = years[years.length - 1];
      const prev = years[years.length - 2];
      const latestVal = perYear.get(latest)!;
      const prevVal = perYear.get(prev)!;
      if (prevVal !== 0) {
        const yoy = ((latestVal - prevVal) / Math.abs(prevVal)) * 100;
        lines.push(`YoY change of ${nKey} from ${prev} to ${latest}: ${yoy >= 0 ? '+' : ''}${Math.round(yoy * 10) / 10}%`);
      }
    }
  }

  // 2) Top-N category contributions for first categorical + numeric
  if (catCols.length > 0 && numericCols.length > 0) {
    const cKey = catCols[0];
    const nKey = numericCols[0];
    const totals = new Map<string, number>();
    let grand = 0;
    rows.forEach((r) => {
      const k = String(r[cKey] ?? '').trim();
      const v = Number(r[nKey]);
      if (k !== '' && !isNaN(v)) {
        totals.set(k, (totals.get(k) || 0) + v);
        grand += v;
      }
    });
    const top = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (grand > 0 && top.length > 0) {
      const parts = top.map(([k, v]) => `${k} (${Math.round((v / grand) * 100)}%)`);
      lines.push(`Top ${cKey} by ${numericCols[0]}: ${parts.join(', ')}`);
    }
  }

  // 3) Outliers (simple z-score > 2.5) on first numeric
  if (numericCols.length > 0) {
    const nKey = numericCols[0];
    const vals = rows.map((r) => Number(r[nKey])).filter((v) => !isNaN(v));
    if (vals.length > 5) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length);
      if (sd > 0) {
        const outliers = vals.filter((v) => Math.abs((v - mean) / sd) > 2.5).length;
        if (outliers > 0) lines.push(`Detected ${outliers} potential outliers in ${nKey} (|z| > 2.5).`);
        else lines.push(`No strong outliers in ${nKey} (stable distribution).`);
      }
    }
  }

  // 4) Correlations: Pearson between numeric pairs |r| >= 0.6
  if (numericCols.length >= 2) {
    const pairs: string[] = [];
    for (let i = 0; i < numericCols.length; i++) {
      for (let j = i + 1; j < numericCols.length; j++) {
        const aKey = numericCols[i];
        const bKey = numericCols[j];
        const aVals: number[] = [];
        const bVals: number[] = [];
        rows.forEach((r) => {
          const a = Number(r[aKey]);
          const b = Number(r[bKey]);
          if (!isNaN(a) && !isNaN(b)) {
            aVals.push(a);
            bVals.push(b);
          }
        });
        if (aVals.length >= 5) {
          const r = pearson(aVals, bVals);
          if (Math.abs(r) >= 0.6) pairs.push(`${aKey} vs ${bKey} (r=${Math.round(r * 100) / 100})`);
        }
      }
    }
    if (pairs.length) lines.push(`Strong correlations: ${pairs.slice(0, 3).join('; ')}`);
  }

  return { lines };
};

const pearson = (x: number[], y: number[]): number => {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denx = 0;
  let deny = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    denx += dx * dx;
    deny += dy * dy;
  }
  const den = Math.sqrt(denx) * Math.sqrt(deny);
  return den === 0 ? 0 : num / den;
};


