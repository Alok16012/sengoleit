-- ============================================================
-- Application Number
-- ------------------------------------------------------------
-- Every center application gets a unique application number the
-- moment it is submitted (format: APP-<year>-<random>, e.g.
-- APP-2026-7K3F9A). The center later enters this number + their
-- email on the university website to track the application's
-- status and pay via the generated link.
--
-- This replaces the earlier "payment_reference_no" idea — the
-- number now lives with the application from submit time, not
-- from when the Account Dept generates a pay link.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS application_no text;

-- Look up an application by its number (university website / status check).
CREATE INDEX IF NOT EXISTS centers_application_no_idx
  ON centers (application_no);

-- Backfill any existing applications that don't have a number yet.
UPDATE centers
SET application_no = 'APP-' || EXTRACT(YEAR FROM COALESCE(created_at, now()))::int
                     || '-' || upper(substr(md5(random()::text || id::text), 1, 6))
WHERE application_no IS NULL;

SELECT 'centers.application_no ready' AS result;
