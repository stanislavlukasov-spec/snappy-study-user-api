const jwt = require('jsonwebtoken');
const { sessionFromQr } = require('../../../src/domain/child/sessionFromQr');

// Mock the DB pool so we never touch a real database
jest.mock('../../../src/shared/db');
const { getPool } = require('../../../src/shared/db');

const SECRET = process.env.JWT_SECRET;

function makeQrToken(overrides = {}) {
  return jwt.sign(
    { type: 'child-qr', parentId: 'p1', childId: 'c1', displayName: 'Lily', ...overrides },
    SECRET,
    { expiresIn: '5m' }
  );
}

beforeEach(() => jest.clearAllMocks());

// ── Validation ────────────────────────────────────────────────────────────────

describe('sessionFromQr – validation', () => {
  it('throws 400 when qrToken is missing', async () => {
    await expect(sessionFromQr({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when qrToken is an empty string', async () => {
    await expect(sessionFromQr({ qrToken: '' })).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── QR token verification ─────────────────────────────────────────────────────

describe('sessionFromQr – QR token verification', () => {
  it('throws 401 for a plain-text qr:p1:c1:timestamp token (unsigned)', async () => {
    await expect(sessionFromQr({ qrToken: 'qr:p1:c1:1234567890' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 for an expired QR JWT', async () => {
    const expired = jwt.sign(
      { type: 'child-qr', parentId: 'p1', childId: 'c1' },
      SECRET,
      { expiresIn: '-1s' }
    );
    await expect(sessionFromQr({ qrToken: expired }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 for a QR JWT signed with wrong secret', async () => {
    const bad = jwt.sign(
      { type: 'child-qr', parentId: 'p1', childId: 'c1' },
      'wrong-secret',
      { expiresIn: '5m' }
    );
    await expect(sessionFromQr({ qrToken: bad }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 for a JWT with wrong type claim', async () => {
    const token = jwt.sign(
      { type: 'child-session', parentId: 'p1', childId: 'c1' },
      SECRET,
      { expiresIn: '5m' }
    );
    await expect(sessionFromQr({ qrToken: token }))
      .rejects.toMatchObject({ statusCode: 401 });
  });
});

// ── Business logic ────────────────────────────────────────────────────────────

describe('sessionFromQr – business logic', () => {
  it('throws 404 when child is not found in the DB', async () => {
    getPool.mockReturnValue({
      query: jest.fn().mockResolvedValue([[]]),
    });
    await expect(sessionFromQr({ qrToken: makeQrToken() }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns a signed child JWT and child info on success', async () => {
    getPool.mockReturnValue({
      // SELECT returns the row; UPDATE (for paired_at) returns a typical mysql2 result
      query: jest.fn()
        .mockResolvedValueOnce([[{ id: 'c1', display_name: 'Lily', paired_at: null }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]),
    });

    const result = await sessionFromQr({ qrToken: makeQrToken() });

    // child now includes parentId so the app can scope data correctly
    expect(result.child).toEqual({ id: 'c1', displayName: 'Lily', parentId: 'p1' });

    // childToken must be a verifiable JWT with the correct claims
    const payload = jwt.verify(result.childToken, SECRET);
    expect(payload.type).toBe('child-session');
    expect(payload.sub).toBe('c1');
    expect(payload.parentId).toBe('p1');
  });

  it('sets paired_at on first scan and skips it when already set', async () => {
    const mockQuery = jest.fn()
      .mockResolvedValueOnce([[{ id: 'c1', display_name: 'Lily', paired_at: null }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    getPool.mockReturnValue({ query: mockQuery });

    await sessionFromQr({ qrToken: makeQrToken() });

    // Second call should be the paired_at UPDATE
    expect(mockQuery).toHaveBeenNthCalledWith(2,
      expect.stringContaining('SET paired_at = NOW()'),
      ['c1']
    );

    // Scanning again when already paired should NOT run the UPDATE
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce([[{ id: 'c1', display_name: 'Lily', paired_at: '2025-01-01' }]]);
    await sessionFromQr({ qrToken: makeQrToken() });
    expect(mockQuery).toHaveBeenCalledTimes(1); // only the SELECT
  });

  it('queries DB with the correct childId and parentId from the QR token', async () => {
    const mockQuery = jest.fn()
      .mockResolvedValueOnce([[{ id: 'c1', display_name: 'Lily', paired_at: null }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    getPool.mockReturnValue({ query: mockQuery });

    await sessionFromQr({ qrToken: makeQrToken() });

    expect(mockQuery).toHaveBeenNthCalledWith(1,
      expect.stringContaining('WHERE id = ?'),
      ['c1', 'p1']
    );
  });
});
