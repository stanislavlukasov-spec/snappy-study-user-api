// Migration runner
//
// How it works:
//   1. Ensures schema_migrations table exists (idempotent).
//   2. Reads all *.sql files from src/migrations/, sorted alphabetically.
//   3. Skips files already recorded in schema_migrations.
//   4. Runs each pending file statement-by-statement.
//   5. Records the filename in schema_migrations on success.
//   6. Stops at the first error and reports it.
//
// All migrations should be written to be idempotent (use IF NOT EXISTS /
// IF EXISTS guards) so they are safe to re-run in case a partial failure
// leaves the tracking table out of sync.

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getPool } = require('../../shared/db');

// Absolute path works both locally and inside the Lambda /var/task/ root
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

// ---------------------------------------------------------------------------

// Step 0 – create the database itself if it doesn't exist yet.
//
// getPool() connects with `database: DB_NAME` already set, so if the database
// hasn't been created yet the pool will throw "Unknown database".  We fix this
// by opening a short-lived raw connection (no database selected), running
// CREATE DATABASE IF NOT EXISTS, then closing it immediately before the pool
// takes over.
async function ensureDatabase() {
  const dbName = process.env.DB_NAME;
  if (!dbName) throw new Error('DB_NAME env var is not set');

  console.log(`[migrate] ensuring database \`${dbName}\` exists…`);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // intentionally NO database field
    ssl: { rejectUnauthorized: false },
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`[migrate] database \`${dbName}\` ready`);
  } finally {
    await conn.end();
  }
}

async function ensureTrackingTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       VARCHAR(255) NOT NULL,
      applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getAppliedMigrations(pool) {
  const [rows] = await pool.query(
    'SELECT name FROM schema_migrations ORDER BY name ASC'
  );
  return new Set(rows.map((r) => r.name));
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexicographic order → 001, 002, 003 …
}

function splitStatements(sql) {
  // Split on semicolons, strip comments, drop empty strings
  return sql
    .split(';')
    .map((s) => {
      // Remove single-line comments (-- …)
      return s
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
        .trim();
    })
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------

async function run() {
  // Step 0 – create the database if it doesn't exist yet (must happen before
  // the pool tries to connect to it).
  await ensureDatabase();

  const pool = getPool();

  await ensureTrackingTable(pool);
  const applied = await getAppliedMigrations(pool);
  const files = getMigrationFiles();

  const results = {
    pending: [],
    applied: [],
    skipped: [],
    errors: [],
  };

  for (const file of files) {
    if (applied.has(file)) {
      results.skipped.push(file);
      console.log(`[migrate] skip   ${file}`);
      continue;
    }

    results.pending.push(file);
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = splitStatements(sql);

    console.log(`[migrate] run    ${file} (${statements.length} statement(s))`);

    try {
      for (const stmt of statements) {
        console.log(`[migrate]   > ${stmt.slice(0, 120).replace(/\n/g, ' ')}…`);
        await pool.query(stmt);
      }

      await pool.query(
        'INSERT IGNORE INTO schema_migrations (name) VALUES (?)',
        [file]
      );

      results.applied.push(file);
      console.log(`[migrate] done   ${file}`);
    } catch (err) {
      console.error(`[migrate] ERROR  ${file}: ${err.message}`);
      results.errors.push({ file, error: err.message });
      // Stop immediately – don't run later migrations against a broken schema
      break;
    }
  }

  const summary = {
    total: files.length,
    applied: results.applied,
    skipped: results.skipped,
    errors: results.errors,
    success: results.errors.length === 0,
  };

  console.log('[migrate] summary:', JSON.stringify(summary));
  return summary;
}

module.exports = { run };
