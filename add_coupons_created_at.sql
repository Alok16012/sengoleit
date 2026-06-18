-- ============================================================
-- Coupons table — add the missing created_at column
-- ------------------------------------------------------------
-- Symptom this fixes: coupons get generated ("X coupons ban gaye")
-- but the Coupon Management table stays empty, with the error:
--   column coupons.created_at does not exist
--
-- The app sorts coupons newest-first and shows a "Generated On"
-- date, both of which need a created_at timestamp. This adds it
-- and backfills existing rows with the current time.
--
-- (The app already degrades gracefully without this, but running
--  it restores correct ordering and the Generated On column.)
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

SELECT 'coupons.created_at ready' AS result;
