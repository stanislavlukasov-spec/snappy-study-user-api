-- Migration 004: Add subscription columns to parents table
ALTER TABLE parents
  ADD COLUMN subscription_status ENUM('trial','active','cancelled') NULL DEFAULT NULL,
  ADD COLUMN trial_ends_at       DATETIME                          NULL DEFAULT NULL,
  ADD COLUMN stripe_customer_id  VARCHAR(64)                       NULL DEFAULT NULL,
  ADD COLUMN stripe_subscription_id VARCHAR(64)                    NULL DEFAULT NULL,
  ADD COLUMN subscription_current_period_end DATETIME             NULL DEFAULT NULL;
