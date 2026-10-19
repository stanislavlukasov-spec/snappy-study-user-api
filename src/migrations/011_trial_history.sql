-- Migration 011 — persist trial usage across account deletion.
--
-- The existing trial check (startTrial.js) compares emails against the
-- parents table. When a user deletes their account (5.1.1(v) compliance),
-- their parents row is gone and the email check no longer protects against
-- re-registering and claiming another free trial.
--
-- This table records every email that has ever started a trial. The email
-- is stored as an HMAC-SHA256 hash keyed with JWT_SECRET so we never retain
-- plaintext PII for deleted accounts — we can only check "has this email
-- already taken a trial?" by comparing hashes.

CREATE TABLE IF NOT EXISTS trial_history (
  email_hash CHAR(64)    NOT NULL,            -- HMAC-SHA256 hex digest
  started_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
