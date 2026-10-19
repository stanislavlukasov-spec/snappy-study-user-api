// Domain: authenticate/register a parent via Google OAuth
//
// Verifies Google ID tokens OFFLINE using bundled public keys (JWKS) so the
// Lambda doesn't need a NAT Gateway to call Google's servers.
//
// The bundled keys are refreshed automatically by deploy.sh before each deploy.
// Google rotates keys every few days; tokens issued before a rotation are still
// valid until their exp — the new bundle will pick them up on the next deploy.
//
// The client may send either:
//   • idToken  – Google ID token (JWT)    ← preferred
//   • accessToken – fallback for Expo Go web flows where idToken is null;
//                   decoded without signature verification (Google already
//                   validated the OAuth exchange), used only to identify user

const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../../shared/db');
const { sendWelcomeEmail } = require('../../shared/email');

// Load bundled JWKS once per Lambda warm instance (zero network calls)
let pemCache = null; // { [kid]: pemString }
function getPemCache() {
  if (pemCache) return pemCache;
  try {
    // eslint-disable-next-line import/no-dynamic-require
    const jwks = require('./googlePublicKeys.json');
    pemCache = {};
    for (const key of jwks.keys) {
      pemCache[key.kid] = jwkToPem(key);
    }
    return pemCache;
  } catch (e) {
    throw new Error(`[googleAuth] Failed to load bundled Google public keys: ${e.message}`);
  }
}

function verifyIdTokenOffline(idToken) {
  // Decode header to get kid (key ID) without verifying signature yet
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded) {
    const err = new Error('Malformed ID token');
    err.statusCode = 401;
    throw err;
  }

  const pems = getPemCache();
  const pem = pems[decoded.header.kid];
  if (!pem) {
    // This can happen if Google rotated keys since the last deploy.
    // The error message tells the operator to redeploy.
    const err = new Error('Google public key not found — redeploy to refresh bundled JWKS');
    err.statusCode = 401;
    throw err;
  }

  try {
    return jwt.verify(idToken, pem, {
      algorithms: ['RS256'],
      audience: process.env.GOOGLE_CLIENT_ID,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    });
  } catch (e) {
    const err = new Error('Invalid Google ID token');
    err.statusCode = 401;
    throw err;
  }
}

// Resolve a Google accessToken to the user's profile by calling Google's
// userinfo endpoint. Native iOS/Android Google OAuth returns OPAQUE access
// tokens (not JWTs), so we can't decode them locally — we have to ask Google.
// The endpoint also doubles as token validation: an invalid/expired token
// returns 401, so a 200 response is proof Google accepts the token.
async function fetchGoogleUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = new Error(`Google userinfo failed (${res.status})`);
    err.statusCode = 401;
    throw err;
  }
  const data = await res.json();
  if (!data.sub) {
    const err = new Error('Google userinfo response missing sub');
    err.statusCode = 401;
    throw err;
  }
  return data; // { sub, email, name, picture, ... }
}

async function resolveGoogleIdentity(idToken, accessToken) {
  if (idToken) {
    try {
      const payload = verifyIdTokenOffline(idToken);
      return {
        googleId: payload.sub,
        email: payload.email,
        displayName: payload.name || payload.email.split('@')[0],
      };
    } catch (err) {
      // If we have an accessToken fallback, log and continue; otherwise rethrow
      if (!accessToken) throw err;
      console.warn('[googleAuth] idToken verification failed, trying accessToken:', err.message);
    }
  }

  if (accessToken) {
    const payload = await fetchGoogleUserInfo(accessToken);
    return {
      googleId: payload.sub,
      email: payload.email,
      displayName: payload.name || (payload.email ? payload.email.split('@')[0] : 'User'),
    };
  }

  const err = new Error('Missing idToken or accessToken');
  err.statusCode = 400;
  throw err;
}

// ─────────────────────────────────────────────────────────────────────────────

async function googleAuth(rawBody) {
  const { idToken, accessToken } = rawBody || {};

  if (!idToken && !accessToken) {
    const err = new Error('Missing idToken or accessToken');
    err.statusCode = 400;
    throw err;
  }

  const { googleId, email, displayName } = await resolveGoogleIdentity(idToken, accessToken);

  const pool = getPool();
  let user;
  let isNewUser = false;

  const [byGoogleId] = await pool.query(
    'SELECT id, email, display_name FROM parents WHERE google_id = ?',
    [googleId]
  );

  if (byGoogleId.length > 0) {
    user = byGoogleId[0];
  } else {
    const [byEmail] = await pool.query(
      'SELECT id, email, display_name FROM parents WHERE email = ?',
      [email]
    );

    if (byEmail.length > 0) {
      user = byEmail[0];
      await pool.query('UPDATE parents SET google_id = ? WHERE id = ?', [googleId, user.id]);
    } else {
      const id = uuidv4();
      await pool.query(
        'INSERT INTO parents (id, email, google_id, display_name) VALUES (?, ?, ?, ?)',
        [id, email, googleId, displayName]
      );
      user = { id, email, display_name: displayName };
      isNewUser = true;
    }
  }

  if (isNewUser) {
    await sendWelcomeEmail(email, displayName);
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

module.exports = { googleAuth };
