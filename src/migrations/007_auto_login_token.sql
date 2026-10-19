-- Migration 007: auto-login token for post-verification silent sign-in

ALTER TABLE parents
  ADD COLUMN auto_login_token VARCHAR(64) NULL DEFAULT NULL,
  ADD COLUMN auto_login_token_expires_at DATETIME NULL DEFAULT NULL;

ALTER TABLE parents
  ADD INDEX idx_parents_auto_login_token (auto_login_token);
