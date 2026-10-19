-- Migration 001 – initial schema
-- Creates the parents table for email/password and Google-authenticated accounts.
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS parents (
  id            VARCHAR(36)  NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255)          DEFAULT NULL,  -- NULL for Google-only accounts
  google_id     VARCHAR(255)          DEFAULT NULL,  -- NULL for email/password accounts
  display_name  VARCHAR(100)          DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_parents_email     (email),
  UNIQUE KEY uq_parents_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
