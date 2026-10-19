#!/usr/bin/env node
// Fetches Google's current OAuth2 public keys (JWKS) and saves them to
// src/shared/googlePublicKeys.json so the Lambda can verify ID tokens
// offline without needing a NAT Gateway.
//
// Run automatically by deploy.sh before packaging, or manually:
//   node scripts/fetch-google-keys.js

const https = require('https');
const fs = require('fs');
const path = require('path');

const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const OUT_PATH = path.join(__dirname, '..', 'src', 'domain', 'auth', 'googlePublicKeys.json');

https.get(JWKS_URI, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Failed to fetch Google JWKS: HTTP ${res.statusCode}`);
    process.exit(1);
  }

  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (!parsed.keys || !parsed.keys.length) {
        console.error('Unexpected JWKS response:', data);
        process.exit(1);
      }
      fs.writeFileSync(OUT_PATH, JSON.stringify(parsed, null, 2));
      console.log(`Saved ${parsed.keys.length} Google public key(s) to ${OUT_PATH}`);
    } catch (e) {
      console.error('Failed to parse JWKS response:', e.message);
      process.exit(1);
    }
  });
}).on('error', (e) => {
  console.error('Network error fetching Google JWKS:', e.message);
  process.exit(1);
});
