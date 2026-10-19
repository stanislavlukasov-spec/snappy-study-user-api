-- Add paired_at to children: records when a child first scanned their QR code.
-- NULL means the child profile exists but has never logged in via QR.

ALTER TABLE children
  ADD COLUMN IF NOT EXISTS paired_at DATETIME NULL DEFAULT NULL;
