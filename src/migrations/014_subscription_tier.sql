-- Migration 014 — subscription tier (Standard vs Family).
--
-- Standard: 1 child profile per parent (€4.99/month).
-- Family:   up to 4 child profiles per parent (€12.99/month).
--
-- Tier is set by the RevenueCat webhook based on the purchased product id and
-- is reset to NULL when the subscription is cancelled / expires. Trial users
-- get 'standard' so they hit the 1-child cap before deciding to upgrade.
--
-- Existing accounts (created before this migration) are left with NULL tier.
-- The application layer treats NULL + an active subscription as 'standard',
-- so legacy users with more than one child are grandfathered: their existing
-- children stay accessible, but they can't add more without upgrading.

ALTER TABLE parents
  ADD COLUMN subscription_tier ENUM('standard','family') NULL DEFAULT NULL;
