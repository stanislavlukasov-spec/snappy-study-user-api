const { getAllChildrenActivity } = require('../../../src/domain/parent/getAllChildrenActivity');

jest.mock('../../../src/shared/db');
const { getPool } = require('../../../src/shared/db');

const mockQuery = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue({ query: mockQuery });
});

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

function makeRow(overrides = {}) {
  return {
    id:                'a1',
    child_id:          'c1',
    child_display_name:'Lily',
    type:              'image_analysis',
    metadata:          JSON.stringify({ language: 'ru', analysisText: 'Привет' }),
    created_at:        '2025-06-01 10:00:00',
    ...overrides,
  };
}

describe('getAllChildrenActivity – shape', () => {
  it('includes childDisplayName on each item', async () => {
    mockQuery.mockResolvedValue([[makeRow()]]);
    const { items } = await getAllChildrenActivity('p1', {});
    expect(items[0].childDisplayName).toBe('Lily');
    expect(items[0].childId).toBe('c1');
  });

  it('deserialises metadata and formats createdAt as ISO string', async () => {
    mockQuery.mockResolvedValue([[makeRow()]]);
    const { items } = await getAllChildrenActivity('p1', {});
    expect(items[0].metadata).toEqual({ language: 'ru', analysisText: 'Привет' });
    expect(items[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('getAllChildrenActivity – pagination', () => {
  it('returns nextBefore as null when fewer items than limit', async () => {
    mockQuery.mockResolvedValue([[makeRow()]]);
    const { nextBefore } = await getAllChildrenActivity('p1', { limit: 20 });
    expect(nextBefore).toBeNull();
  });

  it('returns nextBefore equal to last item createdAt on a full page', async () => {
    const rows = [
      makeRow({ id: 'a1', created_at: '2025-06-02 10:00:00' }),
      makeRow({ id: 'a2', created_at: '2025-06-01 10:00:00' }),
    ];
    mockQuery.mockResolvedValue([rows]);
    const { items, nextBefore } = await getAllChildrenActivity('p1', { limit: 2 });
    expect(nextBefore).toBe(items[items.length - 1].createdAt);
  });

  it('uses the before cursor when provided', async () => {
    mockQuery.mockResolvedValue([[]]);
    const before = '2025-06-01T10:00:00.000Z';
    await getAllChildrenActivity('p1', { before });
    expect(mockQuery.mock.calls[0][0]).toContain('created_at < ?');
    expect(mockQuery.mock.calls[0][1]).toContain(before);
  });

  it('clamps limit to MAX_LIMIT of 50', async () => {
    mockQuery.mockResolvedValue([[]]);
    await getAllChildrenActivity('p1', { limit: 9999 });
    const limitParam = mockQuery.mock.calls[0][1].slice(-1)[0];
    expect(limitParam).toBe(50);
  });
});

describe('getAllChildrenActivity – query', () => {
  it('always JOINs children table to get display names', async () => {
    mockQuery.mockResolvedValue([[]]);
    await getAllChildrenActivity('p1', {});
    expect(mockQuery.mock.calls[0][0]).toContain('JOIN');
    expect(mockQuery.mock.calls[0][0]).toContain('display_name');
  });
});
