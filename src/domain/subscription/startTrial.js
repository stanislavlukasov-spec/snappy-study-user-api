// Domain: POST /subscription/trial – start the 7-day free trial.
//
// Abuse prevention:
//   - Email is verified before login, so we already know it's real.
//   - If the account's email has previously had a trial on ANY account, reject.
//   - The trial can only ever be started once per account.
//   - trial_history (migration 011) records every email that has EVER started
//     a trial, even after the account is deleted, so users can't re-register
//     and claim another trial. Emails are stored only as HMAC-SHA256 hashes
//     so we don't retain PII for deleted accounts.

const { getPool } = require('../../shared/db');
const { sendTrialStartedEmail } = require('../../shared/email');
const { emailHasUsedTrial, recordTrialStart } = require('../../shared/trialHistory');

const TRIAL_DAYS = 7;

async function startTrial(parentId) {
  const pool = getPool();

  const [rows] = await pool.query(
    'SELECT subscription_status, email, display_name FROM parents WHERE id = ?',
    [parentId]
  );

  if (!rows.length) {
    throw Object.assign(new Error('Parent not found'), { statusCode: 404 });
  }

  const { subscription_status: currentStatus, email, display_name: displayName } = rows[0];

  // Already has / had a plan on this account
  if (currentStatus !== null) {
    throw Object.assign(
      new Error('A free trial has already been used on this account'),
      { statusCode: 409 }
    );
  }

  // Cross-account email check — one trial per email address, EVER. The
  // trial_history table survives account deletion, so re-registering with
  // the same email won't unlock a fresh trial.
  if (email) {
    if (await emailHasUsedTrial(email)) {
      throw Object.assign(
        new Error('A free trial has already been used with this email address'),
        { statusCode: 409 }
      );
    }

    // Belt-and-braces: also block when the email currently exists on a
    // different parent row with any subscription history. trial_history is
    // populated below, so this only catches accounts created before the
    // migration ran.
    const [emailRows] = await pool.query(
      'SELECT id FROM parents WHERE email = ? AND subscription_status IS NOT NULL AND id != ?',
      [email, parentId]
    );
    if (emailRows.length > 0) {
      throw Object.assign(
        new Error('A free trial has already been used with this email address'),
        { statusCode: 409 }
      );
    }
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  // Trial users get the Standard tier (1 child cap). Family is paid-only.
  await pool.query(
    `UPDATE parents
       SET subscription_status = ?,
           subscription_tier   = 'standard',
           trial_ends_at       = ?
     WHERE id = ?`,
    ['trial', trialEndsAt, parentId]
  );

  // Record the trial so it persists even if the account is later deleted.
  if (email) {
    await recordTrialStart(email);
  }

  if (email) {
    await sendTrialStartedEmail(email, displayName || 'there', trialEndsAt);
  }

  return {
    subscription: {
      status: 'trial',
      trialEndsAt: trialEndsAt.toISOString(),
    },
  };
}

module.exports = { startTrial };
