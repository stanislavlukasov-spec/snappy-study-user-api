-- Migration 006: add password reset token columns

ALTER TABLE parents
  ADD COLUMN password_reset_token VARCHAR(64) NULL DEFAULT NULL,
  ADD COLUMN password_reset_expires_at DATETIME NULL DEFAULT NULL;

ALTER TABLE parents
  ADD INDEX idx_parents_password_reset_token (password_reset_token);
