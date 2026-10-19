const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { getPool } = require('../../shared/db');

const schema = z.object({
  qrToken: z.string().min(1),
});

async function sessionFromQr(rawBody) {
  const parseResult = schema.safeParse(rawBody);
  if (!parseResult.success) {
    const error = new Error('Invalid body');
    error.statusCode = 400;
    error.details = parseResult.error.issues;
    throw error;
  }

  const { qrToken } = parseResult.data;

  // Verify the signed QR JWT (issued by generateChildQr, expires in 5 min)
  let payload;
  try {
    payload = jwt.verify(qrToken, process.env.JWT_SECRET);
  } catch (err) {
    const error = new Error('Invalid or expired QR code');
    error.statusCode = 401;
    throw error;
  }

  if (payload.type !== 'child-qr') {
    const error = new Error('Invalid QR token type');
    error.statusCode = 401;
    throw error;
  }

  const { parentId, childId } = payload;

  // Verify the child still exists in the DB (may have been deleted since QR was generated)
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT id, display_name, paired_at FROM children WHERE id = ? AND parent_id = ?',
    [childId, parentId]
  );

  if (rows.length === 0) {
    const error = new Error('Child not found');
    error.statusCode = 404;
    throw error;
  }

  const child = rows[0];

  // Mark the child as paired on their first scan (paired_at stays set forever —
  // it records when they first linked their device, not the most recent scan).
  if (!child.paired_at) {
    await pool.query(
      'UPDATE children SET paired_at = NOW() WHERE id = ?',
      [child.id]
    );
  }

  // Issue a long-lived child session token (365 days) so the child stays
  // logged in for as long as possible without needing to re-scan.
  const childToken = jwt.sign(
    { type: 'child-session', sub: child.id, parentId },
    process.env.JWT_SECRET,
    { expiresIn: '365d' }
  );

  return {
    childToken,
    child: { id: child.id, displayName: child.display_name, parentId },
  };
}

module.exports = { sessionFromQr };
