// Shared helpers for the trial_history table (migration 011).
//
// trial_history records every email that has ever started a trial. We store
// only an HMAC-SHA256 hash of the lowercased email so deleted accounts don't
// leave any PII behind — we can still answer "has this email taken a trial?"
// by comparing hashes.

const crypto = require('crypto');
const { getPool } = require('./db');

// Developer backdoor — emails listed here are exempt from the once-per-email
// trial limit so we can re-test the trial → expired → resubscribe flow without
// having to use a new address every time. Keep this list short and only for
// real developer accounts.
const TRIAL_HISTORY_BYPASS = new Set([
  'stasikest89@gmail.com',
]);

// Demo-domain bypass — any address ending in one of these domains is also
// exempt. Used to spin up multiple demo accounts (e.g. demo1@nginetech.com,
// demo2@nginetech.com) without burning their trial eligibility.
const TRIAL_HISTORY_BYPASS_DOMAINS = [
  '@nginetech.com',
];

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function isBypassed(email) {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  if (TRIAL_HISTORY_BYPASS.has(normalized)) return true;
  return TRIAL_HISTORY_BYPASS_DOMAINS.some((d) => normalized.endsWith(d));
}

function hashEmail(email) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || '')
    .update(normalizeEmail(email))
    .digest('hex');
}

// Returns true when the given email has previously started a free trial.
// Backdoor emails always return false so they remain eligible.
async function emailHasUsedTrial(email) {
  if (!email) return false;
  if (isBypassed(email)) return false;
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT email_hash FROM trial_history WHERE email_hash = ? LIMIT 1',
    [hashEmail(email)]
  );
  return rows.length > 0;
}

// Records a trial start so it persists even if the account is later deleted.
// Uses INSERT IGNORE so a race doesn't error — uniqueness is enforced by PK.
// Backdoor emails are NOT recorded, so they stay eligible across resets.
async function recordTrialStart(email) {
  if (!email) return;
  if (isBypassed(email)) return;
  const pool = getPool();
  await pool.query(
    'INSERT IGNORE INTO trial_history (email_hash) VALUES (?)',
    [hashEmail(email)]
  );
}

module.exports = { hashEmail, emailHasUsedTrial, recordTrialStart };
