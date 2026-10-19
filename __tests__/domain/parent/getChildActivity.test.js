const { getChildActivity } = require('../../../src/domain/parent/getChildActivity');

jest.mock('../../../src/shared/db');
const { getPool } = require('../../../src/shared/db');

const mockQuery = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue({ query: mockQuery });
});

const CHILD_ROW  = [{ id: 'c1' }];
const NO_CHILD   = [];

function makeActivityRow(overrides = {}) {
  return {
    id:         'a1',
    type:       'image_analysis',
    metadata:   JSON.stringify({ language: 'ru', extractedText: 'Привет' }),
    created_at: '2025-06-01 10:00:00',
    ...overrides,
  };
}

// ── Child ownership check ─────────────────────────────────────────────────────

describe('getChildActivity – child ownership', () => {
  it('throws 404 when the child does not belong to the parent', async () => {
    mockQuery.mockResolvedValueOnce([NO_CHILD]);
    await expect(getChildActivity('p1', 'c-other', {}))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── Pagination ────────────────────────────────────────────────────────────────

describe('getChildActivity – pagination', () => {
  it('returns items and null nextBefore when fewer items than limit', async () => {
    mockQuery
      .mockResolvedValueOnce([CHILD_ROW])
      .mockResolvedValueOnce([[makeActivityRow()]]);

    const result = await getChildActivity('p1', 'c1', { limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.nextBefore).toBeNull();
  });

  it('returns nextBefore equal to the last item createdAt when a full page is returned', async () => {
    const rows = Array.from({ length: 2 }, (_, i) =>
      makeActivityRow({ id: `a${i}`, created_at: `2025-06-0${2 - i} 10:00:00` })
    );
    mockQuery
      .mockResolvedValueOnce([CHILD_ROW])
      .mockResolvedValueOnce([rows]);

    const result = await getChildActivity('p1', 'c1', { limit: 2 });
    expect(result.nextBefore).toBe(result.items[result.items.length - 1].createdAt);
  });

  it('uses the before cursor in the query when provided', async () => {
    mockQuery
      .mockResolvedValueOnce([CHILD_ROW])
      .mockResolvedValueOnce([[]]);

    const before = '2025-06-01T10:00:00.000Z';
    await getChildActivity('p1', 'c1', { before });
    const activityCall = mockQuery.mock.calls[1];
    expect(activityCall[0]).toContain('created_at < ?');
    expect(activityCall[1]).toContain(before);
  });

  it('clamps limit to MAX_LIMIT (50)', async () => {
    mockQuery
      .mockResolvedValueOnce([CHILD_ROW])
      .mockResolvedValueOnce([[]]);

    await getChildActivity('p1', 'c1', { limit: 9999 });
    const limitParam = mockQuery.mock.calls[1][1].slice(-1)[0];
    expect(limitParam).toBe(50);
  });
});

// ── Shape ─────────────────────────────────────────────────────────────────────

describe('getChildActivity – response shape', () => {
  it('deserialises metadata JSON and formats createdAt as ISO string', async () => {
    mockQuery
      .mockResolvedValueOnce([CHILD_ROW])
      .mockResolvedValueOnce([[makeActivityRow()]]);

    const result = await getChildActivity('p1', 'c1', {});
    const item = result.items[0];
    expect(item.metadata).toEqual({ language: 'ru', extractedText: 'Привет' });
    expect(item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
