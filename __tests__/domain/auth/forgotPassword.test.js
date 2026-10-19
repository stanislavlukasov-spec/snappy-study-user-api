const { forgotPassword } = require('../../../src/domain/auth/forgotPassword');

jest.mock('../../../src/shared/db');
jest.mock('../../../src/shared/email');
jest.mock('crypto');

const { getPool } = require('../../../src/shared/db');
const { sendPasswordResetEmail } = require('../../../src/shared/email');
const crypto = require('crypto');

const mockPool = { query: jest.fn() };
const GENERIC = 'If an account with that email exists, a reset link has been sent.';

beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue(mockPool);
  crypto.randomBytes.mockReturnValue({ toString: jest.fn().mockReturnValue('resettoken123') });
  sendPasswordResetEmail.mockResolvedValue();
});

describe('forgotPassword', () => {
  it('throws 400 when email is not provided', async () => {
    await expect(forgotPassword(undefined)).rejects.toMatchObject({ statusCode: 400 });
    await expect(forgotPassword('')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns generic message when email is not registered', async () => {
    mockPool.query.mockResolvedValueOnce([[]]); // no rows
    const result = await forgotPassword('unknown@test.com');
    expect(result.message).toBe(GENERIC);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('returns generic message for Google-only accounts (no password_hash)', async () => {
    mockPool.query.mockResolvedValueOnce([[{ id: 'p1', display_name: 'Alice', password_hash: null }]]);
    const result = await forgotPassword('alice@test.com');
    expect(result.message).toBe(GENERIC);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('stores a reset token and emails the user for a password account', async () => {
    mockPool.query
      .mockResolvedValueOnce([[{ id: 'p1', display_name: 'Alice', password_hash: '$2b$hash' }]])
      .mockResolvedValueOnce([{}]); // UPDATE

    const result = await forgotPassword('alice@test.com');

    expect(result.message).toBe(GENERIC);

    const updateCall = mockPool.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE parents SET password_reset_token/i);

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      'alice@test.com',
      'Alice',
      expect.stringContaining('reset-password')
    );
  });
});
