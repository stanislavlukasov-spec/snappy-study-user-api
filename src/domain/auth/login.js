// Domain: login a parent with email + password

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { getPool } = require('../../shared/db');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function login(rawBody) {
  const parseResult = loginSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const error = new Error('Invalid body');
    error.statusCode = 400;
    error.details = parseResult.error.issues;
    throw error;
  }

  const { email, password } = parseResult.data;
  const pool = getPool();

  const [rows] = await pool.query(
    'SELECT id, email, password_hash, display_name, email_verified FROM parents WHERE email = ?',
    [email]
  );

  if (rows.length === 0) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const user = rows[0];

  if (!user.password_hash) {
    const error = new Error('This account uses Google sign-in. Please sign in with Google.');
    error.statusCode = 401;
    throw error;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Block login until email is verified
  if (!user.email_verified) {
    const error = new Error('Please verify your email address before logging in.');
    error.statusCode = 403;
    error.code = 'EMAIL_NOT_VERIFIED';
    throw error;
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, displayName: user.display_name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: { id: user.id, email: user.email, displayName: user.display_name },
  };
}

module.exports = { login };
