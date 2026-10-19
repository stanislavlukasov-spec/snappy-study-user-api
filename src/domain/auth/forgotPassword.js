// Domain: POST /auth/forgot-password
//
// Generates a 1-hour password reset token and emails it to the user.
// Always returns a generic success message to prevent email enumeration.
// Google-only accounts (no password_hash) do not receive a reset link.

const crypto = require('crypto');
const { getPool } = require('../../shared/db');
const { sendPasswordResetEmail } = require('../../shared/email');

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

async function forgotPassword(email) {
  if (!email || typeof email !== 'string') {
    throw Object.assign(new Error('email is required'), { statusCode: 400 });
  }

  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT id, display_name, password_hash FROM parents WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()]
  );

  // Security: always respond the same way regardless of whether the email exists
  const GENERIC_RESPONSE = {
    message: 'If an account with that email exists, a reset link has been sent.',
  };

  if (!rows.length) return GENERIC_RESPONSE;

  const { id, display_name: displayName, password_hash: passwordHash } = rows[0];

  // Google-only accounts have no password to reset
  if (!passwordHash) return GENERIC_RESPONSE;

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await pool.query(
    'UPDATE parents SET password_reset_token = ?, password_reset_expires_at = ? WHERE id = ?',
    [token, expiresAt, id]
  );

  const resetUrl = `${process.env.USER_API_BASE_URL}/auth/reset-password?token=${token}`;
  await sendPasswordResetEmail(email, displayName || 'there', resetUrl);

  return GENERIC_RESPONSE;
}

module.exports = { forgotPassword };
