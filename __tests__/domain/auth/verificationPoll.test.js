const jwt = require('jsonwebtoken');
const { verificationPoll } = require('../../../src/domain/auth/verificationPoll');

jest.mock('../../../src/shared/db');
const { getPool } = require('../../../src/shared/db');

const mockPool = { query: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue(mockPool);
});

describe('verificationPoll', () => {
  it('throws 400 when email is not provided', async () => {
    await expect(verificationPoll('')).rejects.toMatchObject({ statusCode: 400 });
    await expect(verificationPoll(undefined)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns { verified: false } when no matching row exists (window expired or unknown email)', async () => {
    mockPool.query.mockResolvedValueOnce([[]]); // no rows
    const result = await verificationPoll('user@test.com');
    expect(result).toEqual({ verified: false });
  });

  it('returns { verified: false } when email is not yet verified', async () => {
    mockPool.query.mockResolvedValueOnce([[{
      id: 'p1', email: 'user@test.com', displayName: 'Alice', emailVerified: 0,
    }]]);
    const result = await verificationPoll('user@test.com');
    expect(result).toEqual({ verified: false });
  });

  it('returns { verified: true, token, user } once email is verified', async () => {
    mockPool.query
      .mockResolvedValueOnce([[{
        id: 'p1', email: 'user@test.com', displayName: 'Alice', emailVerified: 1,
      }]])
      .mockResolvedValueOnce([{}]); // UPDATE clears token

    const result = await verificationPoll('user@test.com');

    expect(result.verified).toBe(true);
    expect(result.token).toBeDefined();
    expect(result.user.id).toBe('p1');
    expect(result.user.email).toBe('user@test.com');

    // Token should be a valid JWT
    const payload = jwt.verify(result.token, process.env.JWT_SECRET);
    expect(payload.sub).toBe('p1');
  });

  it('clears the auto_login_token after issuing a JWT', async () => {
    mockPool.query
      .mockResolvedValueOnce([[{ id: 'p1', email: 'u@t.com', displayName: 'Bob', emailVerified: 1 }]])
      .mockResolvedValueOnce([{}]);

    await verificationPoll('u@t.com');

    const updateCall = mockPool.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/SET auto_login_token = NULL/i);
  });
});
