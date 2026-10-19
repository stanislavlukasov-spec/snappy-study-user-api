-- Migration 012 — App Store reviewer demo account.
--
-- Apple's review team needs credentials for an account with an EXPIRED
-- subscription so they can see and test the paywall (rejection guideline 2.1).
-- This migration creates the account if it doesn't already exist and forces
-- its subscription into the "expired trial" state so the SubscriptionScreen
-- appears immediately on launch.
--
-- Login credentials configured in App Store Connect → App Review Information:
--   User Name: sl+applereview@nginetech.com
--   Password:  AppleReview2026!
--
-- The @nginetech.com suffix also matches the demo-domain bypass in
-- src/shared/trialHistory.js, so the reviewer's trial eligibility stays
-- flexible if they ever sign up fresh.
--
-- Idempotent — INSERT IGNORE skips if the row already exists, and the UPDATE
-- always re-arms the expired state in case a previous deploy or test session
-- moved it.

INSERT IGNORE INTO parents
  (id, email, password_hash, display_name, email_verified)
VALUES (
  '4582669d-7a50-45bc-9966-dd185e352581',
  'sl+applereview@nginetech.com',
  '$2a$12$RTUFwtoDaBHrzsmGWafSFeTyuBjQufrEEWmkouK4oGObcWZ7nPuNS',
  'Apple Reviewer',
  1
);

-- The subscription_status ENUM (migration 004) is ('trial','active','cancelled')
-- — there is no literal 'expired' value. The "expired" state is derived in
-- getMe.js when the trial has an end date in the past, so we set status='trial'
-- with trial_ends_at backdated to one day ago. The client sees status='expired'.
UPDATE parents
   SET subscription_status = 'trial',
       trial_ends_at        = NOW() - INTERVAL 1 DAY
 WHERE email = 'sl+applereview@nginetech.com';
