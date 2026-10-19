-- Migration 010 — add Apple ID column for "Sign in with Apple" accounts.
-- Mirrors the google_id pattern: unique per Apple user, NULL for non-Apple users.

ALTER TABLE parents
  ADD COLUMN apple_id VARCHAR(255) NULL DEFAULT NULL,
  ADD UNIQUE KEY uq_parents_apple_id (apple_id);
