const express = require('express');
const SavedQuery = require('../models/SavedQuery');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  const list = await SavedQuery.find({ userId: req.user._id }).sort({ updatedAt: -1 });
  res.json(list);
});

router.post('/', async (req, res) => {
  const { name, method, path, pathTemplate, params, query, body, headers, description } = req.body;
  if (!name || !method || !path || !pathTemplate) {
    return res.status(400).json({ error: 'name, method, path, and pathTemplate are required' });
  }
  const saved = await SavedQuery.create({
    userId: req.user._id,
    name,
    description,
    method,
    path,
    pathTemplate,
    params: params || {},
    query: query || {},
    body: body || {},
    headers: headers || {},
  });
  res.status(201).json(saved);
});

module.exports = router;
