-- Migration 005: Email verification columns
-- email_verified defaults to 1 for existing rows so current users are not locked out.
-- New registrations will have email_verified = 0 until the link is clicked.
ALTER TABLE parents
  ADD COLUMN email_verified           TINYINT(1)   NOT NULL DEFAULT 1,
  ADD COLUMN email_verification_token VARCHAR(64)  NULL     DEFAULT NULL;

ALTER TABLE parents
  ADD INDEX idx_parents_email_verification_token (email_verification_token);
