// Domain: GET /auth/verify-email?token=xxx
// Marks the parent's email as verified and clears the token.
// Returns an HTML page so the user sees a friendly confirmation in their browser.

const crypto = require('crypto');
const { getPool } = require('../../shared/db');
const { sendWelcomeEmail } = require('../../shared/email');

function successHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email Verified – Snappy Study</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #fff; border-radius: 20px; padding: 48px 40px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size: 56px; margin-bottom: 20px; }
    h1 { font-size: 26px; font-weight: 800; color: #111827; margin-bottom: 12px; }
    p { font-size: 16px; line-height: 1.6; color: #6b7280; }
    .badge { display: inline-block; margin-top: 24px; background: #d1fae5; color: #065f46; font-size: 14px; font-weight: 600; padding: 8px 20px; border-radius: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Email Verified!</h1>
    <p>Your Snappy Study account is now active. Open the Snappy Study app — it will sign you in automatically.</p>
    <div class="badge">You're all set 🎉</div>
  </div>
</body>
</html>`;
}

function errorHtml(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verification Failed – Snappy Study</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #fff; border-radius: 20px; padding: 48px 40px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size: 56px; margin-bottom: 20px; }
    h1 { font-size: 26px; font-weight: 800; color: #111827; margin-bottom: 12px; }
    p { font-size: 16px; line-height: 1.6; color: #6b7280; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Link Expired</h1>
    <p>${message || 'This verification link is invalid or has already been used. Open the app and request a new one.'}</p>
  </div>
</body>
</html>`;
}

function htmlResponse(statusCode, html) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  };
}

async function verifyEmail(token) {
  if (!token) {
    return htmlResponse(400, errorHtml('No verification token provided.'));
  }

  const pool = getPool();

  const [rows] = await pool.query(
    'SELECT id, email, display_name, email_verified FROM parents WHERE email_verification_token = ?',
    [token]
  );

  if (!rows.length) {
    return htmlResponse(400, errorHtml('This verification link is invalid or has already been used. Open the app and request a new one.'));
  }

  const parent = rows[0];

  if (parent.email_verified) {
    // Already verified — show success anyway
    return htmlResponse(200, successHtml());
  }

  // Regenerate the auto-login window so the app can finish signing the user
  // in even if more than the original 30 minutes has passed since registration
  // (the user might leave the verification email unread for a while). The
  // freshly-issued token is single-use — verificationPoll consumes it on first
  // success.
  const autoLoginToken = crypto.randomBytes(32).toString('hex');
  const autoLoginExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await pool.query(
    `UPDATE parents
       SET email_verified = 1,
           email_verification_token = NULL,
           auto_login_token = ?,
           auto_login_token_expires_at = ?
       WHERE id = ?`,
    [autoLoginToken, autoLoginExpiresAt, parent.id]
  );

  // Send the welcome email now that the account is confirmed
  await sendWelcomeEmail(parent.email, parent.display_name || 'there');

  return htmlResponse(200, successHtml());
}

module.exports = { verifyEmail };
