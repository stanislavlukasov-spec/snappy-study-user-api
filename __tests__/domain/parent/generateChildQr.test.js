const jwt = require('jsonwebtoken');
const { generateChildQr } = require('../../../src/domain/parent/generateChildQr');

jest.mock('../../../src/shared/db');
const { getPool } = require('../../../src/shared/db');

const mockPool = { query: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue(mockPool);
});

describe('generateChildQr', () => {
  it('throws 404 when child is not found or does not belong to parent', async () => {
    mockPool.query.mockResolvedValueOnce([[]]); // no rows
    await expect(generateChildQr('p1', 'unknown-child')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns a qrToken on success', async () => {
    mockPool.query.mockResolvedValueOnce([[{ id: 'c1', display_name: 'Lily' }]]);
    const result = await generateChildQr('p1', 'c1');
    expect(result.qrToken).toBeDefined();
  });

  it('issues a JWT with type=child-qr and correct claims', async () => {
    mockPool.query.mockResolvedValueOnce([[{ id: 'c1', display_name: 'Lily' }]]);
    const { qrToken } = await generateChildQr('parent-123', 'c1');

    const payload = jwt.verify(qrToken, process.env.JWT_SECRET);
    expect(payload.type).toBe('child-qr');
    expect(payload.parentId).toBe('parent-123');
    expect(payload.childId).toBe('c1');
    expect(payload.displayName).toBe('Lily');
  });

  it('the QR token expires within 5 minutes', async () => {
    mockPool.query.mockResolvedValueOnce([[{ id: 'c1', display_name: 'Lily' }]]);
    const { qrToken } = await generateChildQr('p1', 'c1');

    const payload = jwt.decode(qrToken);
    const ttlSeconds = payload.exp - payload.iat;
    expect(ttlSeconds).toBeLessThanOrEqual(300);
    expect(ttlSeconds).toBeGreaterThan(0);
  });
});
