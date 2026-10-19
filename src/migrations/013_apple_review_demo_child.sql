-- Migration 013 — demo child for the App Store reviewer account.
--
-- Apple's reviewer needs a working QR code to test the "Login as Child"
-- flow (rejection guideline 2.1(a)). We pre-create a child belonging to
-- the demo parent (migration 012) so a QR token can be generated against
-- a stable child id and shared in App Review Information.
--
-- Idempotent — INSERT IGNORE skips the row if it already exists.

INSERT IGNORE INTO children
  (id, parent_id, display_name)
VALUES (
  '6b2c2f6e-3e2c-4d7e-9f1c-1b5a8e9f7d10',
  '4582669d-7a50-45bc-9966-dd185e352581',
  'Demo Child'
);
