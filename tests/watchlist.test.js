const request = require('supertest');
const app = require('../app');

// listings table has seeded rows; id=1 is "Calculus Textbook"
const LISTING_ID = 1;

let token;

beforeAll(async () => {
  const email = `watchlist_test_${Date.now()}@test.com`;

  await request(app).post('/users/register').send({
    full_name: 'Watchlist Tester',
    email,
    password: 'testpass123',
    university: 'Test University',
  });

  const loginRes = await request(app)
    .post('/users/login')
    .send({ email, password: 'testpass123' });

  token = loginRes.body.data.token;
});

describe('POST /watchlist/:id', () => {
  it('should return 401 without a token', async () => {
    const res = await request(app).post(`/watchlist/${LISTING_ID}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 201 when adding to watchlist with a valid token', async () => {
    const res = await request(app)
      .post(`/watchlist/${LISTING_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(Number(res.body.data.listing_id)).toBe(LISTING_ID);
  });

  it('should return 409 if the listing is already in the watchlist', async () => {
    const res = await request(app)
      .post(`/watchlist/${LISTING_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 for a non-existent listing', async () => {
    const res = await request(app)
      .post('/watchlist/999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /watchlist', () => {
  it('should return 401 without a token', async () => {
    const res = await request(app).get('/watchlist');
    expect(res.status).toBe(401);
  });

  it('should return 200 with the user watchlist', async () => {
    const res = await request(app)
      .get('/watchlist')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('listing_id');
  });
});

describe('DELETE /watchlist/:id', () => {
  it('should return 401 without a token', async () => {
    const res = await request(app).delete(`/watchlist/${LISTING_ID}`);
    expect(res.status).toBe(401);
  });

  it('should return 200 and remove the listing from watchlist', async () => {
    const res = await request(app)
      .delete(`/watchlist/${LISTING_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
