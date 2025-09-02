// backend/src/swaggerCache.js
const fs      = require('fs/promises');
const path    = require('path');
const axios   = require('axios');
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

// 1. Where to cache
const CACHE_FILE = path.resolve(__dirname, '../cache/swagger.json');

// 2. The Genesys OpenAPI endpoint (replace <region> if needed)
const SWAGGER_URL = 'https://api.cac1.pure.cloud/api/v2/api-docs';

// 3. Fetch & save to disk
async function fetchAndCache() {
  try {
    const resp = await axios.get(SWAGGER_URL);
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(resp.data), 'utf8');
    console.log('[swaggerCache] fetched & cached swagger.json');
    return resp.data;
  } catch (err) {
    console.error('[swaggerCache] fetch failed:', err.message);
    throw err;
  }
}

// 4. Load from disk if fresh, else re-fetch
async function getSwagger() {
  try {
    const stat = await fs.stat(CACHE_FILE);
    const age = Date.now() - stat.mtimeMs;
    if (age < CACHE_TTL_MS) {
      const raw = await fs.readFile(CACHE_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (_) {
    // file doesn’t exist or can’t stat → fall through to fetch
  }
  // stale or missing → fetch anew
  return await fetchAndCache();
}

// 5. Optionally, start a background refresher
function scheduleRefresh() {
  // Every hour on the dot
  setInterval(fetchAndCache, CACHE_TTL_MS);
}

module.exports = { getSwagger, scheduleRefresh };
