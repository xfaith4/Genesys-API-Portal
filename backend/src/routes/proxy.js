const express = require('express');
const axios = require('axios');
const authenticate = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

router.use(authenticate);

router.post('/', async (req, res) => {
  const { method, path, query = {}, body, headers = {}, genesysToken } = req.body;
  if (!method || !path) {
    return res.status(400).json({ error: 'method and path required' });
  }

  try {
    const targetUrl = new URL(path, config.genesysApiBaseUrl);
    const response = await axios({
      method,
      url: targetUrl.toString(),
      params: query,
      headers: {
        ...headers,
        ...(genesysToken ? { Authorization: `Bearer ${genesysToken}` } : {}),
      },
      data: body,
    });

    return res.status(response.status).json({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
    });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data || err.response.statusText,
      });
    }
    return res.status(502).json({ error: err.message });
  }
});

module.exports = router;
