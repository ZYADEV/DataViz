const CKAN_BASE = (process.env.REACT_APP_CKAN_BASE || 'https://www.data.gov.ma') + '/api/3/action';

export interface CkanResource {
  id: string;
  name: string;
  format: string;
  url: string;
}

export interface CkanDataset {
  id: string;
  title: string;
  notes?: string;
  organization?: { title?: string };
  resources: CkanResource[];
}

export async function searchDatasets(query: string, rows = 10, start = 0): Promise<CkanDataset[]> {
  const url = `${CKAN_BASE}/package_search?q=${encodeURIComponent(query)}&rows=${rows}&start=${start}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('CKAN search failed');
  const data = await res.json();
  const results: CkanDataset[] = data?.result?.results || [];
  return results;
}


