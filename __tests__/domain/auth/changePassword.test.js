const { changePassword } = require('../../../src/domain/auth/changePassword');

jest.mock('../../../src/shared/db');
jest.mock('bcryptjs');

const { getPool } = require('../../../src/shared/db');
const bcrypt = require('bcryptjs');

const mockPool = { query: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue(mockPool);
});

describe('changePassword – validation', () => {
  it('throws 400 when currentPassword is missing', async () => {
    await expect(changePassword('p1', { newPassword: 'newpass123' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when newPassword is shorter than 8 chars', async () => {
    await expect(changePassword('p1', { currentPassword: 'old', newPassword: 'short' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('changePassword – business logic', () => {
  it('throws 404 when parent not found', async () => {
    mockPool.query.mockResolvedValueOnce([[]]); // SELECT → no rows
    await expect(changePassword('missing-id', { currentPassword: 'old', newPassword: 'newpass123' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 400 for Google-only accounts (no password_hash)', async () => {
    mockPool.query.mockResolvedValueOnce([[{ password_hash: null }]]);
    await expect(changePassword('p1', { currentPassword: 'old', newPassword: 'newpass123' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 401 when currentPassword is wrong', async () => {
    mockPool.query.mockResolvedValueOnce([[{ password_hash: '$2b$hash' }]]);
    bcrypt.compare.mockResolvedValueOnce(false);
    await expect(changePassword('p1', { currentPassword: 'wrong', newPassword: 'newpass123' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('hashes the new password and updates the DB on success', async () => {
    mockPool.query
      .mockResolvedValueOnce([[{ password_hash: '$2b$hash' }]]) // SELECT
      .mockResolvedValueOnce([{}]);                              // UPDATE
    bcrypt.compare.mockResolvedValueOnce(true);
    bcrypt.hash.mockResolvedValueOnce('$2b$newhash');

    const result = await changePassword('p1', { currentPassword: 'correct', newPassword: 'newpass123' });

    expect(bcrypt.hash).toHaveBeenCalledWith('newpass123', 12);
    const updateCall = mockPool.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE parents SET password_hash/i);
    expect(result).toEqual({ success: true });
  });
});
