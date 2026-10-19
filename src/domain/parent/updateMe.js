// Domain: PATCH /me – update parent display name

const { z } = require('zod');
const jwt = require('jsonwebtoken');
const { getPool } = require('../../shared/db');

const updateMeSchema = z.object({
  displayName: z.string().min(1).max(100),
});

async function updateMe(parentId, rawBody) {
  const parseResult = updateMeSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const error = new Error('Invalid body');
    error.statusCode = 400;
    error.details = parseResult.error.issues;
    throw error;
  }

  const { displayName } = parseResult.data;
  const pool = getPool();

  await pool.query(
    'UPDATE parents SET display_name = ? WHERE id = ?',
    [displayName, parentId]
  );

  // Fetch current email to re-sign token
  const [rows] = await pool.query('SELECT email FROM parents WHERE id = ?', [parentId]);
  if (rows.length === 0) {
    const error = new Error('Parent not found');
    error.statusCode = 404;
    throw error;
  }

  const token = jwt.sign(
    { sub: parentId, email: rows[0].email, displayName },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { token, user: { id: parentId, email: rows[0].email, displayName } };
}

module.exports = { updateMe };
