const app = require('./app');
const { connectDatabase } = require('./db');
const { getSwagger, scheduleRefresh } = require('./swaggerCache');
const config = require('./config');

async function startServer() {
  await connectDatabase();

  try {
    await getSwagger();
  } catch (err) {
    console.warn('Unable to prime swagger cache; will retry on demand.', err.message);
  }
  scheduleRefresh();

  app.listen(config.port, () => {
    console.log(`Genesys API portal backend listening on port ${config.port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start backend', err);
  process.exit(1);
});
