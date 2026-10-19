const { login } = require('../../../src/domain/auth/login');

jest.mock('../../../src/shared/db');
jest.mock('bcryptjs');

const { getPool } = require('../../../src/shared/db');
const bcrypt = require('bcryptjs');

const mockPool = { query: jest.fn() };
beforeEach(() => {
  getPool.mockReturnValue(mockPool);
  jest.clearAllMocks();
  getPool.mockReturnValue(mockPool);
});

const VALID_USER = {
  id: 'parent-uuid',
  email: 'user@test.com',
  password_hash: '$2b$12$hashedpassword',
  display_name: 'Alice',
  email_verified: 1,
};

describe('login – validation', () => {
  it('throws 400 for missing email', async () => {
    await expect(login({ password: 'password123' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 for invalid email format', async () => {
    await expect(login({ email: 'not-an-email', password: 'pass' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 for missing password', async () => {
    await expect(login({ email: 'a@b.com' })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('login – authentication', () => {
  it('throws 401 when email is not found', async () => {
    mockPool.query.mockResolvedValueOnce([[]]);
    await expect(login({ email: 'unknown@test.com', password: 'pass123' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 for a Google-only account (no password_hash)', async () => {
    mockPool.query.mockResolvedValueOnce([[{ ...VALID_USER, password_hash: null }]]);
    await expect(login({ email: 'user@test.com', password: 'pass123' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when the password is wrong', async () => {
    mockPool.query.mockResolvedValueOnce([[VALID_USER]]);
    bcrypt.compare.mockResolvedValueOnce(false);
    await expect(login({ email: 'user@test.com', password: 'wrongpass' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 403 with EMAIL_NOT_VERIFIED when email is unverified', async () => {
    mockPool.query.mockResolvedValueOnce([[{ ...VALID_USER, email_verified: 0 }]]);
    bcrypt.compare.mockResolvedValueOnce(true);
    await expect(login({ email: 'user@test.com', password: 'correct' }))
      .rejects.toMatchObject({ statusCode: 403, code: 'EMAIL_NOT_VERIFIED' });
  });

  it('returns a token and user on success', async () => {
    mockPool.query.mockResolvedValueOnce([[VALID_USER]]);
    bcrypt.compare.mockResolvedValueOnce(true);

    const result = await login({ email: 'user@test.com', password: 'correct' });

    expect(result.token).toBeDefined();
    expect(result.user.id).toBe('parent-uuid');
    expect(result.user.email).toBe('user@test.com');
    expect(result.user.displayName).toBe('Alice');
  });

  it('issues a JWT containing the correct sub claim', async () => {
    const jwt = require('jsonwebtoken');
    mockPool.query.mockResolvedValueOnce([[VALID_USER]]);
    bcrypt.compare.mockResolvedValueOnce(true);

    const { token } = await login({ email: 'user@test.com', password: 'correct' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    expect(payload.sub).toBe('parent-uuid');
    expect(payload.email).toBe('user@test.com');
  });
});
