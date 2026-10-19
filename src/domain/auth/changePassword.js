// Domain: POST /auth/change-password

const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { getPool } = require('../../shared/db');

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

async function changePassword(parentId, rawBody) {
  const parseResult = changePasswordSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const error = new Error('Invalid body');
    error.statusCode = 400;
    error.details = parseResult.error.issues;
    throw error;
  }

  const { currentPassword, newPassword } = parseResult.data;
  const pool = getPool();

  const [rows] = await pool.query(
    'SELECT password_hash FROM parents WHERE id = ?',
    [parentId]
  );

  if (rows.length === 0) {
    const error = new Error('Parent not found');
    error.statusCode = 404;
    throw error;
  }

  if (!rows[0].password_hash) {
    const error = new Error('This account uses Google sign-in; no password is set');
    error.statusCode = 400;
    throw error;
  }

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) {
    const error = new Error('Current password is incorrect');
    error.statusCode = 401;
    throw error;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE parents SET password_hash = ? WHERE id = ?', [newHash, parentId]);

  return { success: true };
}

module.exports = { changePassword };
