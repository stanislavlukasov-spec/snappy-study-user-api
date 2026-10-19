const { updateChild } = require('../../../src/domain/parent/updateChild');

jest.mock('../../../src/shared/db');
const { getPool } = require('../../../src/shared/db');

const mockPool = { query: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue(mockPool);
});

describe('updateChild – validation', () => {
  it('throws 400 when displayName is missing', async () => {
    await expect(updateChild('p1', 'c1', {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when displayName is empty', async () => {
    await expect(updateChild('p1', 'c1', { displayName: '' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when displayName exceeds 64 characters', async () => {
    await expect(updateChild('p1', 'c1', { displayName: 'x'.repeat(65) }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('updateChild – business logic', () => {
  it('throws 404 when child not found or does not belong to parent', async () => {
    mockPool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    await expect(updateChild('p1', 'unknown', { displayName: 'New Name' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns the updated child on success', async () => {
    mockPool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await updateChild('p1', 'c1', { displayName: 'Updated Name' });
    expect(result.child).toEqual({ id: 'c1', displayName: 'Updated Name' });
  });

  it('passes correct parentId and childId to the query', async () => {
    mockPool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await updateChild('parent-123', 'child-456', { displayName: 'Test' });

    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/WHERE id = \? AND parent_id = \?/i);
    expect(params).toContain('child-456');
    expect(params).toContain('parent-123');
  });
});
