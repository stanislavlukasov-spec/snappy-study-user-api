const jwt = require('jsonwebtoken');
const { requireParent, requireChild } = require('../../src/shared/auth');

const SECRET = process.env.JWT_SECRET;

function makeParentEvent(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

function makeChildEvent(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

// ── requireParent ──────────────────────────────────────────────────────────────

describe('requireParent', () => {
  it('returns 401 when Authorization header is missing', () => {
    const result = requireParent({ headers: {} });
    expect(result.error.statusCode).toBe(401);
    expect(result.error.body.error).toMatch(/missing authorization/i);
  });

  it('returns 401 when token is expired', () => {
    const expired = jwt.sign({ sub: 'p1', email: 'a@b.com' }, SECRET, { expiresIn: '-1s' });
    const result = requireParent(makeParentEvent(expired));
    expect(result.error.statusCode).toBe(401);
    expect(result.error.body.error).toMatch(/invalid or expired/i);
  });

  it('returns 401 for a token signed with the wrong secret', () => {
    const bad = jwt.sign({ sub: 'p1' }, 'wrong-secret', { expiresIn: '1h' });
    const result = requireParent(makeParentEvent(bad));
    expect(result.error.statusCode).toBe(401);
  });

  it('returns the parent payload for a valid token', () => {
    const token = jwt.sign(
      { sub: 'parent-uuid', email: 'user@test.com', displayName: 'Alice' },
      SECRET,
      { expiresIn: '1h' }
    );
    const result = requireParent(makeParentEvent(token));
    expect(result.parent.id).toBe('parent-uuid');
    expect(result.parent.email).toBe('user@test.com');
    expect(result.parent.displayName).toBe('Alice');
  });

  it('is case-insensitive on the Authorization header key', () => {
    const token = jwt.sign({ sub: 'p1' }, SECRET, { expiresIn: '1h' });
    const result = requireParent({ headers: { authorization: `Bearer ${token}` } });
    expect(result.parent).toBeDefined();
  });

  it('handles mixed-case Bearer prefix', () => {
    const token = jwt.sign({ sub: 'p1' }, SECRET, { expiresIn: '1h' });
    const result = requireParent({ headers: { Authorization: `bearer ${token}` } });
    expect(result.parent).toBeDefined();
  });
});

// ── requireChild ──────────────────────────────────────────────────────────────

describe('requireChild', () => {
  it('returns 401 when Authorization header is missing', () => {
    const result = requireChild({ headers: {} });
    expect(result.error.statusCode).toBe(401);
    expect(result.error.body.error).toMatch(/missing authorization/i);
  });

  it('returns 401 for a plain child-<id>:<parentId> string (unsigned tokens no longer accepted)', () => {
    const result = requireChild(makeChildEvent('child-abc123:parent-xyz'));
    expect(result.error.statusCode).toBe(401);
  });

  it('returns 401 for a random non-JWT string', () => {
    const result = requireChild(makeChildEvent('not-a-token'));
    expect(result.error.statusCode).toBe(401);
  });

  it('returns 401 for an expired child JWT', () => {
    const expired = jwt.sign(
      { type: 'child-session', sub: 'c1', parentId: 'p1' },
      SECRET,
      { expiresIn: '-1s' }
    );
    const result = requireChild(makeChildEvent(expired));
    expect(result.error.statusCode).toBe(401);
    expect(result.error.body.error).toMatch(/invalid or expired/i);
  });

  it('returns 401 for a JWT signed with wrong secret', () => {
    const bad = jwt.sign(
      { type: 'child-session', sub: 'c1', parentId: 'p1' },
      'wrong-secret',
      { expiresIn: '1h' }
    );
    const result = requireChild(makeChildEvent(bad));
    expect(result.error.statusCode).toBe(401);
  });

  it('returns 401 for a valid JWT with wrong type claim', () => {
    const token = jwt.sign(
      { type: 'parent-session', sub: 'c1', parentId: 'p1' },
      SECRET,
      { expiresIn: '1h' }
    );
    const result = requireChild(makeChildEvent(token));
    expect(result.error.statusCode).toBe(401);
    expect(result.error.body.error).toMatch(/invalid child token/i);
  });

  it('returns child payload for a valid signed child-session JWT', () => {
    const token = jwt.sign(
      { type: 'child-session', sub: 'child-uuid', parentId: 'parent-uuid' },
      SECRET,
      { expiresIn: '30d' }
    );
    const result = requireChild(makeChildEvent(token));
    expect(result.child).toBeDefined();
    expect(result.child.id).toBe('child-uuid');
    expect(result.child.parentId).toBe('parent-uuid');
  });

  it('is case-insensitive on the Authorization header key', () => {
    const token = jwt.sign(
      { type: 'child-session', sub: 'c1', parentId: 'p1' },
      SECRET,
      { expiresIn: '1h' }
    );
    const result = requireChild({ headers: { authorization: `Bearer ${token}` } });
    expect(result.child).toBeDefined();
  });
});
