// savedQueries.js — CRUD for user-saved queries
const express = require('express');
const SavedQuery = require('../models/SavedQuery');
const router = express.Router();

// List all for a user (hard-coded userId for now)
router.get('/', async (req, res) => {
  const userId = 'demo-user';
  const list = await SavedQuery.find({ userId });
  res.json(list);
});

// Create a new saved query
router.post('/', async (req, res) => {
  const userId = 'demo-user';
  const { name, method, path, params, body } = req.body;
  const saved = await SavedQuery.create({ userId, name, method, path, params, body });
  res.status(201).json(saved);
});

// Update or delete similarly...
module.exports = router;
