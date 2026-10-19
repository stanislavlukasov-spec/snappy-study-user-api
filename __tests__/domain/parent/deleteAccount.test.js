const { deleteAccount } = require('../../../src/domain/parent/deleteAccount');

jest.mock('../../../src/shared/db');
const { getPool } = require('../../../src/shared/db');

const mockPool = { query: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue(mockPool);
});

describe('deleteAccount', () => {
  it('throws 400 when parentId is missing', async () => {
    await expect(deleteAccount()).rejects.toMatchObject({ statusCode: 400 });
    await expect(deleteAccount(null)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when the parent row does not exist', async () => {
    mockPool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    await expect(deleteAccount('p1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns { deleted: true } on success', async () => {
    mockPool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await deleteAccount('p1');
    expect(result).toEqual({ deleted: true });
  });

  it('issues a DELETE scoped to the parent id (cascade handles dependents)', async () => {
    mockPool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await deleteAccount('parent-abc');

    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM parents WHERE id = \?/i);
    expect(params).toEqual(['parent-abc']);
  });
});
