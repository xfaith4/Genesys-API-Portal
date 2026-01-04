const mongoose = require('mongoose');
const config = require('./config');

async function connectDatabase(uri = config.mongodbUri) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  return mongoose.connection;
}

module.exports = { connectDatabase };
