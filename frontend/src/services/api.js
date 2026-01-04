export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function buildApiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

export async function requestJson(path, options = {}, token) {
  const url = buildApiUrl(path);
  const init = { ...options };
  const headers = { ...(init.headers || {}) };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (init.body && typeof init.body !== 'string') {
    init.body = JSON.stringify(init.body);
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  init.headers = headers;

  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error || payload?.message || response.statusText;
    throw new Error(message || 'Request failed');
  }
  return payload;
}
