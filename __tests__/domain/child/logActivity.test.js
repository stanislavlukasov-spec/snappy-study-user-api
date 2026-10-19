const { logActivity } = require('../../../src/domain/child/logActivity');

jest.mock('../../../src/shared/db');
const { getPool } = require('../../../src/shared/db');

const mockQuery = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue({ query: mockQuery });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('logActivity – validation', () => {
  it('throws 400 when type is missing', async () => {
    await expect(logActivity('c1', 'p1', { metadata: {} }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when type is not a known type', async () => {
    await expect(logActivity('c1', 'p1', { type: 'unknown_type', metadata: {} }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when metadata is missing', async () => {
    await expect(logActivity('c1', 'p1', { type: 'image_analysis' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when metadata is not an object', async () => {
    await expect(logActivity('c1', 'p1', { type: 'image_analysis', metadata: 'bad' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── Success ───────────────────────────────────────────────────────────────────

describe('logActivity – success', () => {
  const metadata = { language: 'ru', extractedText: 'Привет мир', analysisText: 'Hello world' };

  beforeEach(() => {
    mockQuery.mockResolvedValue([{ insertId: 42 }]);
  });

  it('inserts a row and returns id, type, and createdAt', async () => {
    const result = await logActivity('c1', 'p1', { type: 'image_analysis', metadata });
    expect(result.type).toBe('image_analysis');
    expect(result.createdAt).toBeDefined();
  });

  it('passes childId and parentId to the INSERT query', async () => {
    await logActivity('c2', 'p2', { type: 'image_analysis', metadata });
    const [, params] = mockQuery.mock.calls[0];
    expect(params[0]).toBe('c2');
    expect(params[1]).toBe('p2');
  });

  it('serialises metadata to JSON in the INSERT', async () => {
    await logActivity('c1', 'p1', { type: 'image_analysis', metadata });
    const [, params] = mockQuery.mock.calls[0];
    expect(params[3]).toBe(JSON.stringify(metadata));
  });
});
