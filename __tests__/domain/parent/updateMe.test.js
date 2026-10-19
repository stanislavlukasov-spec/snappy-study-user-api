const jwt = require('jsonwebtoken');
const { updateMe } = require('../../../src/domain/parent/updateMe');

jest.mock('../../../src/shared/db');
const { getPool } = require('../../../src/shared/db');

const mockPool = { query: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue(mockPool);
});

describe('updateMe – validation', () => {
  it('throws 400 when displayName is missing', async () => {
    await expect(updateMe('p1', {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when displayName is empty', async () => {
    await expect(updateMe('p1', { displayName: '' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when displayName exceeds 100 characters', async () => {
    await expect(updateMe('p1', { displayName: 'a'.repeat(101) }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('updateMe – business logic', () => {
  it('throws 404 when parent not found after update', async () => {
    mockPool.query
      .mockResolvedValueOnce([{}])  // UPDATE (always succeeds with no affectedRows check)
      .mockResolvedValueOnce([[]]); // SELECT email → no rows
    await expect(updateMe('missing', { displayName: 'Alice' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns a new JWT and updated user on success', async () => {
    mockPool.query
      .mockResolvedValueOnce([{}])                         // UPDATE display_name
      .mockResolvedValueOnce([[{ email: 'u@t.com' }]]);   // SELECT email

    const result = await updateMe('p1', { displayName: 'New Name' });

    expect(result.token).toBeDefined();
    expect(result.user).toEqual({ id: 'p1', email: 'u@t.com', displayName: 'New Name' });
  });

  it('issues a JWT containing the new displayName', async () => {
    mockPool.query
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ email: 'u@t.com' }]]);

    const { token } = await updateMe('p1', { displayName: 'Updated' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    expect(payload.displayName).toBe('Updated');
    expect(payload.sub).toBe('p1');
  });
});
