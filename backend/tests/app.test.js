const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const axios = require('axios');
const config = require('../src/config');
const app = require('../src/app');

jest.mock('axios');

const sampleConversations = [
  {
    conversationId: 'conv-peak',
    conversationStart: '2026-01-01T00:00:00Z',
    conversationEnd: '2026-01-01T00:05:00Z',
    participants: [
      {
        sessions: [
          {
            mediaType: 'voice',
            segments: [
              {
                segmentStart: '2026-01-01T00:00:00Z',
                segmentEnd: '2026-01-01T00:02:00Z',
                segmentType: 'interact',
              },
            ],
          },
        ],
      },
      {
        sessions: [
          {
            mediaType: 'voice',
            segments: [
              {
                segmentStart: '2026-01-01T00:01:00Z',
                segmentEnd: '2026-01-01T00:03:00Z',
                segmentType: 'interact',
              },
            ],
          },
        ],
      },
    ],
  },
];

describe('backend API', () => {
  let mongo;
  const sampleSpec = { info: { title: 'Genesys' }, paths: { '/foo': {} } };

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_SECRET = 'test-secret';
    await mongoose.connect(process.env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(() => {
    const jobStatusUrl = `${config.genesysApiBaseUrl}/api/v2/analytics/conversations/details/jobs/job-peak-1`;
    const resultsUrl = `${jobStatusUrl}/results`;

    axios.post.mockImplementation((url) => {
      if (url === `${config.genesysApiBaseUrl}/api/v2/analytics/conversations/details/jobs`) {
        return Promise.resolve({ data: { id: 'job-peak-1' } });
      }
      return Promise.reject(new Error(`Unexpected POST call: ${url}`));
    });

    axios.get.mockImplementation((url) => {
      if (url === config.swaggerUrl) {
        return Promise.resolve({ data: sampleSpec });
      }
      if (url === jobStatusUrl) {
        return Promise.resolve({ data: { state: 'completed' } });
      }
      if (url === resultsUrl) {
        return Promise.resolve({ data: { conversations: sampleConversations } });
      }
      return Promise.resolve({ data: sampleSpec });
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    const { collections } = mongoose.connection;
    await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
  });

  it('serves the cached swagger spec', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(sampleSpec);
  });

  it('registers, logs in, and stores saved queries for the same user', async () => {
    const user = { name: 'Dev', email: 'dev@example.com', password: 'Password123!' };
    await request(app).post('/api/auth/register').send(user).expect(201);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);

    const token = login.body.token;
    const queryPayload = {
      name: 'list-things',
      method: 'GET',
      path: '/api/v2/foo',
      pathTemplate: '/api/v2/foo',
      query: { page: 1 },
    };

    const saved = await request(app)
      .post('/api/savedQueries')
      .set('Authorization', `Bearer ${token}`)
      .send(queryPayload)
      .expect(201);

    expect(saved.body.name).toBe(queryPayload.name);

    const list = await request(app).get('/api/savedQueries').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ name: queryPayload.name, method: queryPayload.method });
  });

  it('rejects saved query access without a token', async () => {
    await request(app).get('/api/savedQueries').expect(401);
  });

  it('runs the peak concurrency insight pack', async () => {
    const user = { name: 'Insight', email: 'insight@example.com', password: 'Password123!' };
    await request(app).post('/api/auth/register').send(user).expect(201);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);

    const peak = await request(app)
      .post('/api/insights/peakConcurrency')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        genesysToken: 'dummy-genesys-token',
        startDate: '2026-01-01T00:00:00Z',
        endDate: '2026-01-01T00:04:00Z',
        excludeWrapup: true,
      })
      .expect(200);

    expect(peak.body.peakConcurrent).toBe(2);
    expect(peak.body.peakMinutesUtc).toContain('2026-01-01T00:01:00.000Z');
  });
});
