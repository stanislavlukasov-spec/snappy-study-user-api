-- Migration 005: Remove Stripe-specific columns and add in-app-purchase (RevenueCat) columns.
-- Subscriptions are now handled via Apple App Store / Google Play through RevenueCat.
-- The parent's id is used as the RevenueCat app_user_id, so no separate id column is needed.

ALTER TABLE parents
  DROP COLUMN stripe_customer_id,
  DROP COLUMN stripe_subscription_id,
  ADD COLUMN subscription_store VARCHAR(32)  NULL DEFAULT NULL,
  ADD COLUMN store_product_id   VARCHAR(128) NULL DEFAULT NULL;
