const autoBaseUrl =
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : 'http://localhost:3001');

const envBaseUrl = import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim();

export const PRIMARY_API_BASE_URL = (envBaseUrl || autoBaseUrl).replace(/\/+$/, '');
export const FALLBACK_API_BASE_URL = autoBaseUrl.replace(/\/+$/, '');

export function buildApiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${PRIMARY_API_BASE_URL}${normalized}`;
}

async function doFetch(url, options) {
  const init = { ...options };
  const headers = { ...(init.headers || {}) };

  if (init.body && typeof init.body !== 'string') {
    init.body = JSON.stringify(init.body);
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  init.headers = headers;
  return fetch(url, init);
}

export async function requestJson(path, options = {}, token) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const requestWithBase = async (baseUrl) => {
    const url = `${baseUrl}${normalizedPath}`;
    const init = { ...options };
    const headers = { ...(init.headers || {}) };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    init.headers = headers;
    return doFetch(url, init);
  };

  let response;
  let payload;

  try {
    response = await requestWithBase(PRIMARY_API_BASE_URL);
    payload = await response.json().catch(() => null);
    if (!response.ok && PRIMARY_API_BASE_URL !== FALLBACK_API_BASE_URL) {
      // Try fallback if the primary base URL is unreachable or refused.
      if (response.status === 0) {
        response = await requestWithBase(FALLBACK_API_BASE_URL);
        payload = await response.json().catch(() => null);
      }
    }
  } catch (err) {
    if (PRIMARY_API_BASE_URL !== FALLBACK_API_BASE_URL) {
      try {
        response = await requestWithBase(FALLBACK_API_BASE_URL);
        payload = await response.json().catch(() => null);
      } catch (err2) {
        throw err2;
      }
    } else {
      throw err;
    }
  }
  if (!response.ok) {
    const message = payload?.error || payload?.message || response.statusText;
    throw new Error(message || 'Request failed');
  }
  return payload;
}
