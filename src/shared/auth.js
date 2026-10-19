// Auth helpers – both parent and child tokens are signed JWTs.

const jwt = require('jsonwebtoken');

function requireParent(event) {
  const headers = normalizeHeaders(event.headers || {});
  const authHeader = headers['authorization'];
  if (!authHeader) {
    return { error: { statusCode: 401, body: { error: 'Missing Authorization header' } } };
  }
  const token = authHeader.replace(/^Bearer\s+/i, '');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return {
      parent: {
        id: payload.sub,
        email: payload.email,
        displayName: payload.displayName || null,
      },
    };
  } catch (err) {
    return { error: { statusCode: 401, body: { error: 'Invalid or expired token' } } };
  }
}

function requireChild(event) {
  const headers = normalizeHeaders(event.headers || {});
  const authHeader = headers['authorization'];
  if (!authHeader) {
    return { error: { statusCode: 401, body: { error: 'Missing Authorization header (child)' } } };
  }
  const token = authHeader.replace(/^Bearer\s+/i, '');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'child-session') {
      return { error: { statusCode: 401, body: { error: 'Invalid child token' } } };
    }
    return {
      child: {
        id: payload.sub,
        parentId: payload.parentId || null,
      },
    };
  } catch (err) {
    return { error: { statusCode: 401, body: { error: 'Invalid or expired child token' } } };
  }
}

function normalizeHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    out[String(k).toLowerCase()] = v;
  }
  return out;
}

module.exports = { requireParent, requireChild };
