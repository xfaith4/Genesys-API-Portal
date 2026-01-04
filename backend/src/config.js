const path = require('path');

require('dotenv').config();

const genesysApiBaseUrl =
  (process.env.GENESYS_API_BASE_URL && process.env.GENESYS_API_BASE_URL.replace(/\/+$/, '')) ||
  'https://api.cac1.pure.cloud/api/v2';

module.exports = {
  port: Number(process.env.PORT) || 4000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/genesys-portal',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  genesysApiBaseUrl,
  swaggerUrl: process.env.GENESYS_SWAGGER_URL || `${genesysApiBaseUrl}/api-docs`,
  swaggerCacheFile:
    (process.env.SWAGGER_CACHE_FILE?.trim() &&
      path.resolve(process.cwd(), process.env.SWAGGER_CACHE_FILE.trim())) ||
    path.resolve(__dirname, '../cache/swagger.json'),
};
