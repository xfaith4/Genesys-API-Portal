// backend/src/index.js (or wherever you wire up Express)
const express = require('express');
const { getSwagger, scheduleRefresh } = require('./swaggerCache');

const app = express();
app.use(express.json());

// Kick off the first fetch + start the hourly refresh
getSwagger()
  .then(() => scheduleRefresh())
  .catch(() => {
    console.warn('Unable to prime swagger cache; will retry on demand.');
  });

// Serve the cached swagger to your front-end
app.get('/api/openapi.json', async (req, res) => {
  try {
    const spec = await getSwagger();
    res.json(spec);
  } catch {
    res.status(502).json({ error: 'Unable to load swagger spec' });
  }
});

// … your other routes, Mongo, HTTPS server, etc.
