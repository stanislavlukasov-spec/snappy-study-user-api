const { deleteChild } = require('../../../src/domain/parent/deleteChild');

jest.mock('../../../src/shared/db');
const { getPool } = require('../../../src/shared/db');

const mockPool = { query: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue(mockPool);
});

describe('deleteChild', () => {
  it('throws 404 when child not found or belongs to a different parent', async () => {
    mockPool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    await expect(deleteChild('p1', 'unknown-child')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns { deleted: true } on success', async () => {
    mockPool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await deleteChild('p1', 'c1');
    expect(result).toEqual({ deleted: true });
  });

  it('issues a DELETE scoped to both childId and parentId', async () => {
    mockPool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await deleteChild('parent-abc', 'child-xyz');

    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM children WHERE id = \? AND parent_id = \?/i);
    expect(params).toContain('child-xyz');
    expect(params).toContain('parent-abc');
  });
});
