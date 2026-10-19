// MySQL connection pool – shared across all Lambda handlers in the same warm instance.
//
// DB Schema (run once on your RDS instance):
//
//   CREATE TABLE IF NOT EXISTS parents (
//     id           VARCHAR(36)  PRIMARY KEY,
//     email        VARCHAR(255) UNIQUE NOT NULL,
//     password_hash VARCHAR(255),          -- NULL for Google-only accounts
//     google_id    VARCHAR(255) UNIQUE,    -- NULL for email/password accounts
//     display_name VARCHAR(100),
//     created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
//     updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//   );

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

let pool = null;

// AWS RDS CA bundle — bundled by deploy.sh at build time.
// Downloaded from: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
const CA_BUNDLE_PATH = path.join(__dirname, 'rds-ca-bundle.pem');

function getSslConfig() {
  if (fs.existsSync(CA_BUNDLE_PATH)) {
    return { ca: fs.readFileSync(CA_BUNDLE_PATH), rejectUnauthorized: true };
  }
  // Fallback for local dev when cert hasn't been downloaded yet.
  // Run: curl -o src/shared/rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
  console.warn('[db] RDS CA bundle not found — falling back to rejectUnauthorized:false (local dev only)');
  return { rejectUnauthorized: false };
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      ssl: getSslConfig(),
    });
  }
  return pool;
}

module.exports = { getPool };
