const fs = require('fs');
const path = require('path');

require('dotenv').config();

const genesysApiBaseUrl =
  (process.env.GENESYS_API_BASE_URL && process.env.GENESYS_API_BASE_URL.replace(/\/+$/, '')) ||
  'https://api.cac1.pure.cloud/api/v2';

function resolveCachePath() {
  const envPath = process.env.SWAGGER_CACHE_FILE && process.env.SWAGGER_CACHE_FILE.trim();
  const defaultPath = path.resolve(__dirname, '../cache/swagger.json');
  if (!envPath) {
    return defaultPath;
  }

  const candidates = [];
  if (path.isAbsolute(envPath)) {
    candidates.push(envPath);
  } else {
    // Resolve relative to the backend root (one level above /src).
    const backendRoot = path.resolve(__dirname, '..');
    candidates.push(path.resolve(backendRoot, envPath));
  }

  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) {
        return candidate;
      }
    } catch (_) {
      // ignore
    }
  }

  // Fall back to default cache path so we never write into unexpected nested folders.
  return defaultPath;
}

module.exports = {
  port: Number(process.env.PORT) || 4000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/genesys-portal',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  genesysApiBaseUrl,
  swaggerUrl: process.env.GENESYS_SWAGGER_URL || `${genesysApiBaseUrl}/api-docs`,
  swaggerCacheFile: resolveCachePath(),
};
