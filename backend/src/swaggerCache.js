const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const config = require('./config');

const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
const CACHE_FILE = config.swaggerCacheFile;

async function writeCache(data) {
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(data), 'utf8');
}

async function fetchSwagger() {
  const response = await axios.get(config.swaggerUrl);
  await writeCache(response.data);
  console.log(`[swaggerCache] fetched swagger from Genesys -> ${config.swaggerUrl}`);
  return response.data;
}

async function readCache() {
  const raw = await fs.readFile(CACHE_FILE, 'utf8');
  return JSON.parse(raw);
}

async function getSwagger() {
  let cache;
  try {
    const stat = await fs.stat(CACHE_FILE);
    const age = Date.now() - stat.mtimeMs;
    cache = await readCache();
    if (age < CACHE_TTL_MS) {
      console.log(`[swaggerCache] using cached swagger at ${CACHE_FILE} (age ${(age / 1000).toFixed(0)}s)`);
      return cache;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[swaggerCache] cache read error', err.message);
    }
  }

  try {
    return await fetchSwagger();
  } catch (err) {
    console.warn('[swaggerCache] fetch failed, falling back to cache', err.message);
    if (cache) {
      return cache;
    }
    throw err;
  }
}

function scheduleRefresh() {
  setInterval(() => {
    fetchSwagger().catch((err) => {
      console.warn('[swaggerCache] refresh failed', err.message);
    });
  }, CACHE_TTL_MS);
}

module.exports = { getSwagger, scheduleRefresh };
