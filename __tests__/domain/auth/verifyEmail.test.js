const { verifyEmail } = require('../../../src/domain/auth/verifyEmail');

jest.mock('../../../src/shared/db');
jest.mock('../../../src/shared/email');

const { getPool } = require('../../../src/shared/db');
const { sendWelcomeEmail } = require('../../../src/shared/email');

const mockPool = { query: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue(mockPool);
  sendWelcomeEmail.mockResolvedValue();
});

describe('verifyEmail', () => {
  it('returns 400 HTML when no token is provided', async () => {
    const res = await verifyEmail(undefined);
    expect(res.statusCode).toBe(400);
    expect(res.headers['Content-Type']).toMatch(/text\/html/);
  });

  it('returns 400 HTML when token is not found in the DB', async () => {
    mockPool.query.mockResolvedValueOnce([[]]); // no rows
    const res = await verifyEmail('invalid-token');
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatch(/invalid or has already been used/i);
  });

  it('returns 200 HTML immediately when email is already verified', async () => {
    mockPool.query.mockResolvedValueOnce([[{
      id: 'p1', email: 'u@t.com', display_name: 'Alice', email_verified: 1,
    }]]);

    const res = await verifyEmail('already-used-token');
    expect(res.statusCode).toBe(200);
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('marks email as verified, clears the token, sends welcome email', async () => {
    mockPool.query
      .mockResolvedValueOnce([[{ id: 'p1', email: 'u@t.com', display_name: 'Alice', email_verified: 0 }]])
      .mockResolvedValueOnce([{}]); // UPDATE

    const res = await verifyEmail('valid-token');

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatch(/verified/i);

    const updateCall = mockPool.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/SET email_verified = 1/i);

    expect(sendWelcomeEmail).toHaveBeenCalledWith('u@t.com', 'Alice');
  });

  it('regenerates the auto_login_token with a fresh expiry so the app can finish signing in', async () => {
    mockPool.query
      .mockResolvedValueOnce([[{ id: 'p1', email: 'u@t.com', display_name: 'Alice', email_verified: 0 }]])
      .mockResolvedValueOnce([{}]); // UPDATE

    const before = Date.now();
    await verifyEmail('valid-token');
    const after = Date.now();

    const [sql, params] = mockPool.query.mock.calls[1];
    expect(sql).toMatch(/auto_login_token = \?/i);
    expect(sql).toMatch(/auto_login_token_expires_at = \?/i);

    // params: [autoLoginToken, autoLoginExpiresAt, parent.id]
    const [autoLoginToken, autoLoginExpiresAt, id] = params;
    expect(typeof autoLoginToken).toBe('string');
    expect(autoLoginToken).toHaveLength(64); // 32 random bytes hex-encoded
    expect(autoLoginExpiresAt).toBeInstanceOf(Date);
    const expiryMs = autoLoginExpiresAt.getTime();
    const thirtyMinMs = 30 * 60 * 1000;
    expect(expiryMs).toBeGreaterThanOrEqual(before + thirtyMinMs - 1000);
    expect(expiryMs).toBeLessThanOrEqual(after + thirtyMinMs + 1000);
    expect(id).toBe('p1');
  });
});
