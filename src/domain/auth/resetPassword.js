// Domain: GET + POST /auth/reset-password
//
// GET  ?token=...  → returns a styled HTML form for the user to enter a new password
// POST body: token + password + confirmPassword → validates, updates DB, returns HTML result page

const bcrypt = require('bcryptjs');
const { getPool } = require('../../shared/db');
const { htmlResponse } = require('../../shared/http');

// ---------------------------------------------------------------------------
// Shared HTML shell
// ---------------------------------------------------------------------------
function page(title, content, isError = false) {
  const headerGradient = isError
    ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
  const icon = isError ? '❌' : '✅';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} – Snappy Study</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 20px; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; }
    .card { width: 100%; max-width: 440px; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.10); }
    .card-header { background: ${headerGradient}; padding: 36px 32px 28px; text-align: center; color: #fff; }
    .card-header .icon { font-size: 48px; margin-bottom: 8px; }
    .card-header h1 { margin: 0; font-size: 24px; font-weight: 800; }
    .card-header p { margin: 6px 0 0; font-size: 14px; opacity: 0.85; }
    .card-body { padding: 28px 32px 32px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    input[type=password] { width: 100%; padding: 12px 14px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 15px; outline: none; transition: border-color 0.15s; margin-bottom: 16px; background: #f9fafb; }
    input[type=password]:focus { border-color: #6c63ff; background: #fff; }
    .error-msg { color: #b91c1c; font-size: 13px; margin: -10px 0 14px; display: none; }
    button[type=submit] { width: 100%; height: 50px; border: none; border-radius: 25px; background: linear-gradient(135deg, #6c63ff 0%, #48cae4 100%); color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; transition: opacity 0.15s; }
    button[type=submit]:hover { opacity: 0.9; }
    button[type=submit]:disabled { opacity: 0.55; cursor: not-allowed; }
    .hint { font-size: 12px; color: #9ca3af; text-align: center; margin-top: 16px; }
    .success-msg { font-size: 15px; color: #374151; line-height: 1.7; text-align: center; }
    .back-link { display: block; text-align: center; margin-top: 24px; font-size: 14px; color: #6c63ff; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <div class="icon">${icon}</div>
      <h1>${title}</h1>
    </div>
    <div class="card-body">
      ${content}
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// GET – show the reset form
// ---------------------------------------------------------------------------
async function showResetForm(token) {
  if (!token) {
    return htmlResponse(400, page('Invalid Link', `
      <p class="success-msg">This password reset link is missing a token. Please use the link from your email.</p>
    `, true));
  }

  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT id FROM parents WHERE password_reset_token = ? AND password_reset_expires_at > NOW()',
    [token]
  );

  if (!rows.length) {
    return htmlResponse(400, page('Link Expired', `
      <p class="success-msg">This password reset link has expired or already been used. Please request a new one in the app.</p>
    `, true));
  }

  const formContent = `
    <form id="resetForm" method="POST" action="/auth/reset-password" onsubmit="return validate()">
      <input type="hidden" name="token" value="${token}" />
      <label for="password">New password</label>
      <input type="password" id="password" name="password" placeholder="At least 8 characters" required />
      <label for="confirm">Confirm new password</label>
      <input type="password" id="confirm" name="confirm" placeholder="Repeat your new password" required />
      <p class="error-msg" id="errMsg">Passwords do not match.</p>
      <button type="submit" id="btn">Set New Password</button>
      <p class="hint">Minimum 8 characters. Your session will remain active.</p>
    </form>
    <script>
      function validate() {
        var p = document.getElementById('password').value;
        var c = document.getElementById('confirm').value;
        var err = document.getElementById('errMsg');
        if (p.length < 8) { err.textContent = 'Password must be at least 8 characters.'; err.style.display = 'block'; return false; }
        if (p !== c) { err.textContent = 'Passwords do not match.'; err.style.display = 'block'; return false; }
        err.style.display = 'none';
        document.getElementById('btn').disabled = true;
        document.getElementById('btn').textContent = 'Updating…';
        return true;
      }
    </script>
  `;

  return htmlResponse(200, page('Set New Password', formContent));
}

// ---------------------------------------------------------------------------
// POST – process the form submission
// ---------------------------------------------------------------------------
async function processReset({ token, password, confirm }) {
  if (!token) {
    return htmlResponse(400, page('Error', `
      <p class="success-msg">Missing reset token. Please use the link from your email.</p>
    `, true));
  }

  if (!password || password.length < 8) {
    return htmlResponse(400, page('Error', `
      <p class="success-msg">Password must be at least 8 characters. Please go back and try again.</p>
    `, true));
  }

  if (password !== confirm) {
    return htmlResponse(400, page('Error', `
      <p class="success-msg">Passwords do not match. Please go back and try again.</p>
    `, true));
  }

  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT id FROM parents WHERE password_reset_token = ? AND password_reset_expires_at > NOW()',
    [token]
  );

  if (!rows.length) {
    return htmlResponse(400, page('Link Expired', `
      <p class="success-msg">This reset link has expired or already been used. Please request a new one in the Snappy Study app.</p>
    `, true));
  }

  const newHash = await bcrypt.hash(password, 12);
  await pool.query(
    'UPDATE parents SET password_hash = ?, password_reset_token = NULL, password_reset_expires_at = NULL WHERE id = ?',
    [newHash, rows[0].id]
  );

  return htmlResponse(200, page('Password Updated!', `
    <p class="success-msg">
      Your password has been changed successfully.<br /><br />
      You can now open the Snappy Study app and sign in with your new password.
    </p>
  `));
}

module.exports = { showResetForm, processReset };
