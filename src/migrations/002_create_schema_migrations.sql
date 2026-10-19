-- Migration 002 – migration tracking table
-- The runner creates this automatically before processing any files,
-- but keeping it here makes the history self-documenting.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS schema_migrations (
  name       VARCHAR(255) NOT NULL,
  applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
