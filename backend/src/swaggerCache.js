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
  console.log('[swaggerCache] fetched swagger from Genesys');
  return response.data;
}

async function readCache() {
  const raw = await fs.readFile(CACHE_FILE, 'utf8');
  return JSON.parse(raw);
}

async function getSwagger() {
  try {
    const stat = await fs.stat(CACHE_FILE);
    const age = Date.now() - stat.mtimeMs;
    if (age < CACHE_TTL_MS) {
      return await readCache();
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[swaggerCache] cache read error', err.message);
    }
  }
  return await fetchSwagger();
}

function scheduleRefresh() {
  setInterval(() => {
    fetchSwagger().catch((err) => {
      console.warn('[swaggerCache] refresh failed', err.message);
    });
  }, CACHE_TTL_MS);
}

module.exports = { getSwagger, scheduleRefresh };
