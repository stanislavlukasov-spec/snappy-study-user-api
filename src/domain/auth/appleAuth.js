// Domain: authenticate/register a parent via "Sign in with Apple".
//
// The native iOS Apple sign-in flow (expo-apple-authentication) returns an
// identityToken which is a JWT signed by Apple. We verify it against Apple's
// JWKS, then look the parent up by their Apple sub (stable user id).
//
// Quirks of Apple Sign In to be aware of:
//   • The user's email is ONLY returned by Apple on the very first sign-in
//     for a given app + Apple ID. On subsequent sign-ins, email is absent.
//   • The user may choose "Hide My Email", in which case Apple returns an
//     anonymous @privaterelay.appleid.com relay address — we store that.
//   • The full name is provided by the client (also first-time only) and is
//     passed in separately because Apple doesn't include it in the JWT.
//
// The Lambda has internet access (NAT Gateway), so we fetch Apple's JWKS live
// with an in-memory cache. The keys don't rotate often; on rotation we
// refetch automatically when an unknown kid arrives.
//
// The client may send:
//   • identityToken — Apple-signed JWT (required)
//   • fullName      — { givenName, familyName } object (first sign-in only)
//   • email         — email returned by Apple in the JWT (we trust JWT over this)

const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../../shared/db');
const { sendWelcomeEmail } = require('../../shared/email');

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

// In-memory JWKS cache. We refetch when a token's kid isn't present (key rotation).
let pemCache = null; // { [kid]: pemString }

async function refreshAppleJwks() {
  const res = await fetch(APPLE_JWKS_URL);
  if (!res.ok) throw new Error(`Apple JWKS fetch failed (${res.status})`);
  const { keys } = await res.json();
  const next = {};
  for (const key of keys) next[key.kid] = jwkToPem(key);
  pemCache = next;
}

async function getPemForKid(kid) {
  if (!pemCache || !pemCache[kid]) {
    await refreshAppleJwks();
  }
  return pemCache[kid];
}

async function verifyAppleIdentityToken(identityToken) {
  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded) {
    const err = new Error('Malformed Apple identity token');
    err.statusCode = 401;
    throw err;
  }

  const pem = await getPemForKid(decoded.header.kid);
  if (!pem) {
    const err = new Error('Apple public key not found for kid');
    err.statusCode = 401;
    throw err;
  }

  try {
    return jwt.verify(identityToken, pem, {
      algorithms: ['RS256'],
      audience: process.env.APPLE_BUNDLE_ID, // e.g. com.snappystudy.app
      issuer: APPLE_ISSUER,
    });
  } catch (e) {
    const err = new Error('Invalid Apple identity token');
    err.statusCode = 401;
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function appleAuth(rawBody) {
  const { identityToken, fullName, email: clientEmail } = rawBody || {};

  if (!identityToken) {
    const err = new Error('Missing identityToken');
    err.statusCode = 400;
    throw err;
  }

  const payload = await verifyAppleIdentityToken(identityToken);
  const appleId = payload.sub;
  // Email from the JWT is authoritative; fall back to client-supplied (first
  // sign-in only) if Apple omitted it from the token.
  const email = payload.email || clientEmail || null;

  if (!appleId) {
    const err = new Error('Apple identity token missing sub');
    err.statusCode = 401;
    throw err;
  }

  // Derive a display name. Apple sends fullName only on first sign-in,
  // and only via the client (not the JWT). Fall back to the email prefix
  // or a generic label if neither is available.
  const displayName = (fullName && (
      [fullName.givenName, fullName.familyName].filter(Boolean).join(' ').trim()
    )) || (email ? email.split('@')[0] : 'User');

  const pool = getPool();
  let user;
  let isNewUser = false;

  const [byAppleId] = await pool.query(
    'SELECT id, email, display_name FROM parents WHERE apple_id = ?',
    [appleId]
  );

  if (byAppleId.length > 0) {
    user = byAppleId[0];
  } else if (email) {
    const [byEmail] = await pool.query(
      'SELECT id, email, display_name FROM parents WHERE email = ?',
      [email]
    );

    if (byEmail.length > 0) {
      user = byEmail[0];
      await pool.query('UPDATE parents SET apple_id = ? WHERE id = ?', [appleId, user.id]);
    } else {
      const id = uuidv4();
      await pool.query(
        'INSERT INTO parents (id, email, apple_id, display_name) VALUES (?, ?, ?, ?)',
        [id, email, appleId, displayName]
      );
      user = { id, email, display_name: displayName };
      isNewUser = true;
    }
  } else {
    // No email returned (subsequent sign-in for an account we don't recognise
    // by apple_id). Without an email we cannot create a parent row, because
    // email is NOT NULL. The user must complete the email sign-up flow or
    // sign in with Apple again on a device that has the original email.
    const err = new Error(
      'Apple did not return an email for this sign-in. Try email sign-up, or sign in with Apple from the original device.'
    );
    err.statusCode = 400;
    throw err;
  }

  if (isNewUser) {
    // Welcome email — fire-and-forget; failure shouldn't block sign-up.
    try { await sendWelcomeEmail(email, displayName); } catch (_) {}
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, displayName: user.display_name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
    },
  };
}

module.exports = { appleAuth };
