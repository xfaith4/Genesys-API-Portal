const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const axios = require('axios');
const app = require('../src/app');

jest.mock('axios');

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
    axios.get.mockResolvedValue({ data: sampleSpec });
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
});
