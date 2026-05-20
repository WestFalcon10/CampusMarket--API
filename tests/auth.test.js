const request = require('supertest');
const app = require('../app');

const testEmail = `auth_test_${Date.now()}@test.com`;
const testPassword = 'testpass123';

describe('POST /users/register', () => {
  it('should register a new user and return 201 with user data', async () => {
    const res = await request(app)
      .post('/users/register')
      .send({
        full_name: 'Test User',
        email: testEmail,
        password: testPassword,
        university: 'Test University',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.email).toBe(testEmail);
    expect(res.body.data).not.toHaveProperty('password_hash');
  });

  it('should return 409 if email is already registered', async () => {
    const res = await request(app)
      .post('/users/register')
      .send({
        full_name: 'Test User',
        email: testEmail,
        password: testPassword,
        university: 'Test University',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 if required fields are missing', async () => {
    const res = await request(app)
      .post('/users/register')
      .send({ email: 'missing@fields.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /users/login', () => {
  it('should login and return 200 with a JWT token', async () => {
    const res = await request(app)
      .post('/users/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user.email).toBe(testEmail);
  });

  it('should return 401 with wrong password', async () => {
    const res = await request(app)
      .post('/users/login')
      .send({ email: testEmail, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 for unregistered email', async () => {
    const res = await request(app)
      .post('/users/login')
      .send({ email: 'nobody@nowhere.com', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
