import { FilterConfig } from '../types';

const KEY = 'state';

export interface SharedState {
  filters: Array<Pick<FilterConfig, 'column' | 'type' | 'selected'>>;
}

export const encodeFiltersToHash = (filters: FilterConfig[]): void => {
  try {
    const payload: SharedState = {
      filters: filters.map((f) => ({ column: f.column, type: f.type, selected: f.selected })),
    };
    const json = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const url = new URL(window.location.href);
    url.hash = `${KEY}=${b64}`;
    window.history.replaceState(null, '', url.toString());
  } catch {}
};

export const decodeFiltersFromHash = (): SharedState | null => {
  try {
    const match = window.location.hash.match(/state=([^&]+)/);
    if (!match) return null;
    const json = decodeURIComponent(escape(atob(match[1])));
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as SharedState;
  } catch {
    return null;
  }
};


