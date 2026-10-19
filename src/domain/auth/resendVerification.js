// Domain: POST /auth/resend-verification
// Generates a fresh token and resends the verification email.
// Rate-limited in a basic way: only resends if the account is still unverified.

const crypto = require('crypto');
const { getPool } = require('../../shared/db');
const { sendVerificationEmail } = require('../../shared/email');

function buildVerifyUrl(token) {
  const base = process.env.USER_API_BASE_URL ||
    'https://5d2ayknq9l.execute-api.eu-central-1.amazonaws.com';
  return `${base}/auth/verify-email?token=${token}`;
}

async function resendVerification(email) {
  if (!email) {
    throw Object.assign(new Error('Email is required'), { statusCode: 400 });
  }

  const pool = getPool();

  const [rows] = await pool.query(
    'SELECT id, display_name, email_verified FROM parents WHERE email = ?',
    [email]
  );

  // Always return 200 — don't reveal whether the email exists
  if (!rows.length || rows[0].email_verified) {
    return { message: 'If that email is registered and unverified, a new link has been sent.' };
  }

  const parent = rows[0];
  const newToken = crypto.randomBytes(32).toString('hex');
  // Refresh the auto-login token so the app can restart polling with a fresh TTL
  const newAutoLoginToken = crypto.randomBytes(32).toString('hex');
  const newAutoLoginExpiry = new Date(Date.now() + 30 * 60 * 1000);

  await pool.query(
    `UPDATE parents
     SET email_verification_token = ?,
         auto_login_token = ?,
         auto_login_token_expires_at = ?
     WHERE id = ?`,
    [newToken, newAutoLoginToken, newAutoLoginExpiry, parent.id]
  );

  await sendVerificationEmail(email, parent.display_name || 'there', buildVerifyUrl(newToken));

  // The auto_login_token is purely server-side — the app polls by email, so it
  // doesn't need to know the token value. The refreshed token extends the
  // 30-minute polling window automatically.
  return { message: 'If that email is registered and unverified, a new link has been sent.' };
}

module.exports = { resendVerification };
