const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const User = require('../models/User');

const router = express.Router();

function ensureOidcConfig() {
  const { oidc } = config;
  return oidc.authUrl && oidc.tokenUrl && oidc.clientId && oidc.clientSecret && oidc.redirectUri;
}

function buildState() {
  return jwt.sign({ ts: Date.now() }, config.jwtSecret, { expiresIn: '10m' });
}

function verifyState(state) {
  return jwt.verify(state, config.jwtSecret);
}

function decodeIdToken(idToken) {
  try {
    const [, payload] = idToken.split('.');
    const json = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

async function getUserInfo(tokens) {
  if (config.oidc.userInfoUrl && tokens.access_token) {
    try {
      const resp = await axios.get(config.oidc.userInfoUrl, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      return resp.data;
    } catch (_) {
      // fall back to id_token
    }
  }
  if (tokens.id_token) {
    return decodeIdToken(tokens.id_token);
  }
  return null;
}

router.get('/login', (req, res) => {
  if (!ensureOidcConfig()) {
    return res.status(503).json({ error: 'SSO is not configured on the server' });
  }

  const state = buildState();
  const url = new URL(config.oidc.authUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.oidc.clientId);
  url.searchParams.set('redirect_uri', config.oidc.redirectUri);
  url.searchParams.set('scope', config.oidc.scopes);
  url.searchParams.set('state', state);

  return res.redirect(url.toString());
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state' });
  }
  if (!ensureOidcConfig()) {
    return res.status(503).json({ error: 'SSO is not configured on the server' });
  }

  try {
    verifyState(state);
  } catch (_) {
    return res.status(400).json({ error: 'Invalid state' });
  }

  try {
    const tokenResp = await axios.post(
      config.oidc.tokenUrl,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.oidc.redirectUri,
        client_id: config.oidc.clientId,
        client_secret: config.oidc.clientSecret,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const tokens = tokenResp.data || {};
    const profile = await getUserInfo(tokens);
    const email = profile?.email || profile?.preferred_username;
    const name = profile?.name || profile?.given_name || profile?.preferred_username || email;

    if (!email) {
      return res.status(400).json({ error: 'SSO provider did not return an email' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      const randomPassword = await bcrypt.hash(`sso-${Date.now()}-${Math.random()}`, 6);
      user = await User.create({
        email: email.toLowerCase(),
        name: name || email,
        passwordHash: randomPassword,
      });
    }

    const token = jwt.sign({ sub: user._id }, config.jwtSecret, { expiresIn: '7d' });

    const redirect = new URL(config.frontendUrl || 'http://localhost:5173');
    redirect.hash = `token=${encodeURIComponent(token)}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}`;
    return res.redirect(redirect.toString());
  } catch (err) {
    return res.status(502).json({ error: err.message || 'SSO exchange failed' });
  }
});

module.exports = router;
