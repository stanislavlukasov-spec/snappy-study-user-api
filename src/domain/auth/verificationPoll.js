// Domain: GET /auth/verification-poll?email=...
//
// The app polls this every 2 seconds while showing the "check your inbox" screen.
// Returns { verified: false } until the user clicks the email link.
// Returns { verified: true, token, user } once confirmed and clears the one-time
// auto_login_token so it can't be reused.
//
// Security: the auto_login_token is generated server-side on register/resend and
// is only valid for 30 minutes. The app never sees the token — it just passes
// the email. This means polling stops being useful once the window expires.

const jwt = require('jsonwebtoken');
const { getPool } = require('../../shared/db');

async function verificationPoll(email) {
  if (!email) {
    throw Object.assign(new Error('email is required'), { statusCode: 400 });
  }

  const pool = getPool();

  // Look up a parent whose auto-login window is still open
  const [rows] = await pool.query(
    `SELECT id, email, display_name AS displayName, email_verified AS emailVerified
     FROM parents
     WHERE email = ?
       AND auto_login_token IS NOT NULL
       AND auto_login_token_expires_at > NOW()
     LIMIT 1`,
    [email]
  );

  if (!rows.length) {
    // Email not found, or the 30-minute auto-login window has expired
    return { verified: false };
  }

  const { id, email: userEmail, displayName, emailVerified } = rows[0];

  if (!emailVerified) {
    // Still waiting for the user to click the link
    return { verified: false };
  }

  // Email verified — issue a JWT and clear the one-time token
  const token = jwt.sign(
    { sub: id, email: userEmail, displayName },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  await pool.query(
    'UPDATE parents SET auto_login_token = NULL, auto_login_token_expires_at = NULL WHERE id = ?',
    [id]
  );

  return {
    verified: true,
    token,
    user: { id, email: userEmail, displayName },
  };
}

module.exports = { verificationPoll };
