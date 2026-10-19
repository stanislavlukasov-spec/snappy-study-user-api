// Domain: register a new parent with email + password

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { getPool } = require('../../shared/db');
const { sendVerificationEmail } = require('../../shared/email');

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(100),
});

// The verification link points to the public Lambda endpoint
function buildVerifyUrl(token) {
  const base = process.env.USER_API_BASE_URL ||
    'https://5d2ayknq9l.execute-api.eu-central-1.amazonaws.com';
  return `${base}/auth/verify-email?token=${token}`;
}

async function register(rawBody) {
  const parseResult = registerSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const error = new Error('Invalid body');
    error.statusCode = 400;
    error.details = parseResult.error.issues;
    throw error;
  }

  const { email, password, displayName } = parseResult.data;
  const pool = getPool();

  // Check if email already in use
  const [existing] = await pool.query(
    'SELECT id FROM parents WHERE email = ?',
    [email]
  );
  if (existing.length > 0) {
    const error = new Error('Email already in use');
    error.statusCode = 409;
    throw error;
  }

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  // Short-lived token the app polls while showing the "check your inbox" screen.
  // Once email_verified flips to 1, the poll endpoint exchanges this for a JWT.
  const autoLoginToken = crypto.randomBytes(32).toString('hex');
  const autoLoginExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await pool.query(
    `INSERT INTO parents
       (id, email, password_hash, display_name, email_verified, email_verification_token,
        auto_login_token, auto_login_token_expires_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    [id, email, passwordHash, displayName, verificationToken,
     autoLoginToken, autoLoginExpiresAt]
  );

  // Send verification email — must be awaited (Lambda freezes on return)
  await sendVerificationEmail(email, displayName, buildVerifyUrl(verificationToken));

  // Return a flag so the app knows to show the "check your email" screen.
  // autoLoginToken lets the app poll until verification is confirmed.
  return { emailVerificationRequired: true, email, autoLoginToken };
}

module.exports = { register };
