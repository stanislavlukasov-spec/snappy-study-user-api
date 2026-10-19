const { createChild } = require('../../../src/domain/parent/createChild');

jest.mock('../../../src/shared/db');
jest.mock('uuid');

const { getPool } = require('../../../src/shared/db');
const { v4: uuidv4 } = require('uuid');

const mockPool = { query: jest.fn() };

beforeEach(() => {
  // mockReset rather than clearAllMocks so queued mockResolvedValueOnce
  // returns don't leak between tests.
  mockPool.query.mockReset();
  getPool.mockReset();
  getPool.mockReturnValue(mockPool);
  uuidv4.mockReset();
  uuidv4.mockReturnValue('new-child-uuid');
});

// createChild fans out two parallel SELECTs (tier + count) before the INSERT.
// Helper queues them in order so each test only has to specify what matters.
function mockPreflight({ tier = null, count = 0 } = {}) {
  mockPool.query
    .mockResolvedValueOnce([[{ subscription_tier: tier }]])
    .mockResolvedValueOnce([[{ cnt: count }]]);
}

describe('createChild – validation', () => {
  it('throws 400 when displayName is missing', async () => {
    await expect(createChild('p1', {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when displayName is empty', async () => {
    await expect(createChild('p1', { displayName: '' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when displayName exceeds 64 characters', async () => {
    await expect(createChild('p1', { displayName: 'a'.repeat(65) }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('createChild – Standard tier (1-child cap)', () => {
  it('rejects a second child with 403 and CHILD_LIMIT_STANDARD code', async () => {
    mockPreflight({ tier: 'standard', count: 1 });
    await expect(createChild('p1', { displayName: 'Second Kid' }))
      .rejects.toMatchObject({ statusCode: 403, code: 'CHILD_LIMIT_STANDARD' });
  });

  it('allows the first child for a Standard subscriber', async () => {
    mockPreflight({ tier: 'standard', count: 0 });
    mockPool.query.mockResolvedValueOnce([{}]); // INSERT

    const result = await createChild('p1', { displayName: 'Lily' });
    expect(result.child.displayName).toBe('Lily');
  });

  it('treats NULL tier as Standard (grandfathers legacy rows)', async () => {
    mockPreflight({ tier: null, count: 1 });
    await expect(createChild('p1', { displayName: 'Another' }))
      .rejects.toMatchObject({ statusCode: 403, code: 'CHILD_LIMIT_STANDARD' });
  });

  it('does NOT delete existing children when a grandfathered parent is over the cap (read-only enforcement)', async () => {
    mockPreflight({ tier: null, count: 3 }); // legacy user with 3 kids
    await expect(createChild('p1', { displayName: 'Fourth' }))
      .rejects.toMatchObject({ statusCode: 403 });
    // No DELETE ever issued — only the two preflight SELECTs were called.
    expect(mockPool.query).toHaveBeenCalledTimes(2);
  });
});

describe('createChild – Family tier (4-child cap)', () => {
  it('allows up to 4 children', async () => {
    mockPreflight({ tier: 'family', count: 3 });
    mockPool.query.mockResolvedValueOnce([{}]); // INSERT

    const result = await createChild('p1', { displayName: 'Max' });
    expect(result.child.displayName).toBe('Max');
  });

  it('rejects a fifth child with CHILD_LIMIT_FAMILY code', async () => {
    mockPreflight({ tier: 'family', count: 4 });
    await expect(createChild('p1', { displayName: 'Fifth' }))
      .rejects.toMatchObject({ statusCode: 403, code: 'CHILD_LIMIT_FAMILY' });
  });
});

describe('createChild – insert shape', () => {
  it('inserts a child and returns id + displayName', async () => {
    mockPreflight({ tier: 'family', count: 0 });
    mockPool.query.mockResolvedValueOnce([{}]);

    const result = await createChild('p1', { displayName: 'Lily' });

    expect(result.child.id).toBe('new-child-uuid');
    expect(result.child.displayName).toBe('Lily');
    expect(result.child.createdAt).toBeDefined();

    const insertCall = mockPool.query.mock.calls[2];
    expect(insertCall[0]).toMatch(/INSERT INTO children/i);
    expect(insertCall[1]).toContain('p1');
    expect(insertCall[1]).toContain('Lily');
  });
});
