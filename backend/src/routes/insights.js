const express = require('express');
const axios = require('axios');
const authenticate = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

const POLL_INTERVAL_MS = 100;
const MAX_POLL_ATTEMPTS = 60;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function floorToMinute(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), 0)
  );
}

function ceilToMinute(date) {
  const floored = floorToMinute(date);
  if (date > floored) {
    return new Date(floored.getTime() + 60 * 1000);
  }
  return floored;
}

function safeDate(value) {
  if (value == null) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function sessionWindow(session, conversation, excludeWrapup) {
  const segments = Array.isArray(session?.segments) ? session.segments : [];
  const validSegments = segments.filter((seg) => seg?.segmentStart);
  if (!validSegments.length && !conversation) {
    return null;
  }

  const parse = (value) => safeDate(value);

  const startCandidates = [];
  const endCandidates = [];

  validSegments.forEach((segment) => {
    const segStart = parse(segment.segmentStart);
    if (segStart) {
      startCandidates.push(segStart);
      if (!excludeWrapup || segment.segmentType !== 'wrapup') {
        const segEnd = segment.segmentEnd ? parse(segment.segmentEnd) : null;
        if (segEnd) {
          endCandidates.push(segEnd);
        }
      }
    }

    if (excludeWrapup && segment.segmentType === 'wrapup' && segment.segmentStart) {
      endCandidates.push(parse(segment.segmentStart));
    }
    if (!excludeWrapup && segment.segmentEnd) {
      endCandidates.push(parse(segment.segmentEnd));
    }
  });

  const conversationStart = parse(conversation?.conversationStart) || parse(conversation?.startTime);
  const conversationEnd = parse(conversation?.conversationEnd) || parse(conversation?.endTime);
  if (conversationStart) {
    startCandidates.push(conversationStart);
  }
  if (conversationEnd) {
    endCandidates.push(conversationEnd);
  }

  if (!startCandidates.length || !endCandidates.length) {
    return null;
  }

  const start = startCandidates.reduce((a, b) => (a < b ? a : b));
  const end = endCandidates.reduce((a, b) => (a > b ? a : b));
  if (end <= start) {
    return null;
  }

  return { start, end };
}

function computePeakMetrics(conversations, startUtc, endUtc, excludeWrapup) {
  const totalMinutes = Math.max(1, Math.ceil((endUtc - startUtc) / 60000));
  const diff = new Array(totalMinutes + 2).fill(0);

  const bucketMinutes = (date) => Math.floor((date - startUtc) / 60000);

  conversations.forEach((conv) => {
    const participants = Array.isArray(conv?.participants) ? conv.participants : [];
    participants.forEach((participant) => {
      const sessions = Array.isArray(participant?.sessions) ? participant.sessions : [];
      sessions.forEach((session) => {
        if (session?.mediaType !== 'voice') {
          return;
        }

        const window = sessionWindow(session, conv, excludeWrapup);
        if (!window) {
          return;
        }

        const startBucket = Math.max(0, bucketMinutes(floorToMinute(window.start)));
        const endBucketEx = Math.min(totalMinutes, bucketMinutes(ceilToMinute(window.end)));
        if (endBucketEx <= startBucket) {
          return;
        }

        diff[startBucket] += 1;
        diff[endBucketEx] -= 1;
      });
    });
  });

  let running = 0;
  let peak = 0;
  let firstPeakMinuteUtc = null;
  const peakMinutesUtc = [];

  for (let i = 0; i <= totalMinutes; i += 1) {
    running += diff[i];
    if (running > peak) {
      peak = running;
      firstPeakMinuteUtc = new Date(startUtc.getTime() + i * 60000).toISOString();
      peakMinutesUtc.length = 0;
      peakMinutesUtc.push(new Date(startUtc.getTime() + i * 60000).toISOString());
    } else if (running === peak && peak > 0) {
      peakMinutesUtc.push(new Date(startUtc.getTime() + i * 60000).toISOString());
    }
  }

  return {
    startDateUtc: startUtc.toISOString(),
    endDateUtc: endUtc.toISOString(),
    bucket: '1m',
    peakConcurrent: peak,
    firstPeakMinuteUtc,
    peakMinutesUtc,
  };
}

async function pollJobStatus(jobId, headers) {
  const jobUrl = `${config.genesysApiBaseUrl}/api/v2/analytics/conversations/details/jobs/${jobId}`;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const resp = await axios.get(jobUrl, { headers });
    const state = resp.data?.state?.toLowerCase();
    if (state === 'completed') {
      return resp.data;
    }
    if (state === 'failed' || state === 'canceled' || state === 'cancelled') {
      throw new Error(`Analytics job ended with state: ${state}`);
    }
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error('Analytics job did not complete in time');
}

async function fetchConversations(jobId, headers) {
  let nextUri = `${config.genesysApiBaseUrl}/api/v2/analytics/conversations/details/jobs/${jobId}/results`;
  const conversations = [];

  while (nextUri) {
    const resp = await axios.get(nextUri, { headers });
    const data = resp.data;
    if (Array.isArray(data?.conversations)) {
      conversations.push(...data.conversations);
    }
    if (data?.nextUri) {
      try {
        nextUri = new URL(data.nextUri, config.genesysApiBaseUrl).toString();
      } catch {
        nextUri = null;
      }
    } else {
      nextUri = null;
    }
  }

  return conversations;
}

router.post('/peakConcurrency', authenticate, async (req, res) => {
  const { startDate, endDate, excludeWrapup = true, genesysToken: bodyToken } = req.body;
  const genesysToken =
    bodyToken || req.headers['x-genesys-token'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!genesysToken) {
    return res.status(400).json({ error: 'Genesys access token required' });
  }

  const now = new Date();
  const startUtc = safeDate(startDate) || new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const endUtc = safeDate(endDate) || now;
  if (!startUtc || !endUtc || endUtc <= startUtc) {
    return res.status(400).json({ error: 'Invalid startDate/endDate' });
  }

  try {
    const chunk = {
      interval: `${startUtc.toISOString()}/${endUtc.toISOString()}`,
      order: 'asc',
      orderBy: 'conversationStart',
      segmentFilters: [
        {
          type: 'and',
          predicates: [
            {
              type: 'dimension',
              dimension: 'mediaType',
              value: 'voice',
            },
          ],
        },
      ],
    };

    const headers = {
      Authorization: `Bearer ${genesysToken}`,
      'Content-Type': 'application/json',
    };

    const jobResp = await axios.post(
      `${config.genesysApiBaseUrl}/api/v2/analytics/conversations/details/jobs`,
      chunk,
      { headers }
    );
    const jobId = jobResp.data?.id;
    if (!jobId) {
      throw new Error('Failed to create analytics job');
    }

    await pollJobStatus(jobId, headers);
    const conversations = await fetchConversations(jobId, headers);
    const peakMetrics = computePeakMetrics(conversations, startUtc, endUtc, Boolean(excludeWrapup));

    return res.json({
      jobId,
      totalConversations: conversations.length,
      ...peakMetrics,
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

module.exports = { router, computePeakMetrics };
