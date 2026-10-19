// Generates a signed JWT used as the QR code payload.
// The child scans this JWT; POST /child-session/qr verifies it and issues
// a child-scoped session token. Tokens expire after 5 minutes so a
// screenshot cannot be replayed indefinitely.

const jwt = require('jsonwebtoken');
const { getPool } = require('../../shared/db');

// The App Store reviewer's demo parent (seeded in migration 012). Their QR
// codes are signed with a long expiry so the screenshot they're given in App
// Review Information stays valid across re-reviews and resubmissions.
const APPLE_REVIEW_PARENT_ID = '4582669d-7a50-45bc-9966-dd185e352581';

async function generateChildQr(parentId, childId) {
  const pool = getPool();

  const [rows] = await pool.query(
    'SELECT id, display_name FROM children WHERE id = ? AND parent_id = ?',
    [childId, parentId]
  );

  if (rows.length === 0) {
    const error = new Error('Child not found');
    error.statusCode = 404;
    throw error;
  }

  const child = rows[0];

  const expiresIn = parentId === APPLE_REVIEW_PARENT_ID ? '180d' : '5m';

  const qrToken = jwt.sign(
    { type: 'child-qr', parentId, childId: child.id, displayName: child.display_name },
    process.env.JWT_SECRET,
    { expiresIn }
  );

  return { qrToken };
}

module.exports = { generateChildQr };
