const express = require('express');
const cors = require('cors');
const { getSwagger } = require('./swaggerCache');
const authRoutes = require('./routes/auth');
const savedRoutes = require('./routes/savedQueries');
const proxyRoutes = require('./routes/proxy');
const insightsRoutes = require('./routes/insights');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/openapi.json', async (req, res) => {
  try {
    const spec = await getSwagger();
    res.json(spec);
  } catch (err) {
    res.status(502).json({ error: 'Unable to load swagger spec' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/savedQueries', savedRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/insights', insightsRoutes.router);

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
