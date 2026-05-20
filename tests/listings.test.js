const request = require('supertest');
const app = require('../app');

let token;

beforeAll(async () => {
  const email = `listings_test_${Date.now()}@test.com`;

  await request(app).post('/users/register').send({
    full_name: 'Listings Tester',
    email,
    password: 'testpass123',
    university: 'Test University',
  });

  const res = await request(app)
    .post('/users/login')
    .send({ email, password: 'testpass123' });

  token = res.body.data.token;
});

describe('GET /listings/all', () => {
  it('should return 200 with an array of listings', async () => {
    const res = await request(app).get('/listings/all');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should return filtered results for ?keyword=calculus', async () => {
    const res = await request(app).get('/listings/all?keyword=calculus');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach((listing) => {
      const haystack = `${listing.title} ${listing.description || ''}`.toLowerCase();
      expect(haystack).toContain('calculus');
    });
  });

  it('should return filtered results for a valid category_id', async () => {
    const res = await request(app).get('/listings/all?category_id=1');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach((listing) => {
      expect(listing.category_id).toBe(1);
    });
  });
});

describe('POST /listings/add', () => {
  it('should return 401 without a token', async () => {
    const res = await request(app).post('/listings/add').send({
      title: 'Unauthorized listing',
      price: 10,
      category_id: 1,
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 201 and create a listing with a valid token', async () => {
    const res = await request(app)
      .post('/listings/add')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Calculus Textbook 3rd Ed',
        description: 'Barely used, great condition',
        price: 45.00,
        category_id: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.title).toBe('Calculus Textbook 3rd Ed');
    expect(parseFloat(res.body.data.price)).toBe(45.00);
  });

  it('should return 400 if required fields are missing', async () => {
    const res = await request(app)
      .post('/listings/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'No title or price' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
