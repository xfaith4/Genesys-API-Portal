// SavedQuery.js — Mongoose model
const mongoose = require('mongoose');

const savedQuerySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String },
    method: { type: String, required: true },
    path: { type: String, required: true },
    pathTemplate: { type: String, required: true },
    params: { type: Object, default: {} },
    query: { type: Object, default: {} },
    body: { type: Object, default: {} },
    headers: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SavedQuery', savedQuerySchema);
