// index.js — Express server for saved-queries
const express = require('express');
const mongoose = require('mongoose');
const savedQueriesRouter = require('./routes/savedQueries');
require('dotenv').config();

const app = express();
app.use(express.json());

// CORS & simple auth stub
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// Mount our saved-queries API
app.use('/api/savedQueries', savedQueriesRouter);

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB error', err));

// Start HTTP
app.listen(process.env.PORT || 4000, () => {
  console.log(`API listening on port ${process.env.PORT||4000}`);
});
