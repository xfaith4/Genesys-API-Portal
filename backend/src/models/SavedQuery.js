// SavedQuery.js — Mongoose model
const mongoose = require('mongoose');

const savedQuerySchema = new mongoose.Schema({
  userId:   { type: String, required: true },
  name:     { type: String, required: true },
  method:   { type: String, required: true },
  path:     { type: String, required: true },
  params:   { type: Object, default: {} },
  body:     { type: Object, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('SavedQuery', savedQuerySchema);
