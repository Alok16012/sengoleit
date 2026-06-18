-- ============================================================
-- Coupons table — allow the admin app to READ & WRITE coupons
-- ------------------------------------------------------------
-- Symptom this fixes: coupons get generated ("X coupons ban gaye")
-- but the Coupon Management table stays empty / "No coupons found".
-- That happens when Row Level Security is ON for `coupons` but there
-- is no SELECT policy, so reads come back empty even though the rows
-- exist in the database.
--
-- This adds permissive policies so the app (anon/authenticated key)
-- can select, insert, and update coupon rows. Tighten later if you
-- add proper role checks.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

-- Make sure RLS is on (it usually already is).
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Drop old copies so re-running this is safe.
DROP POLICY IF EXISTS "coupons_select_all" ON coupons;
DROP POLICY IF EXISTS "coupons_insert_all" ON coupons;
DROP POLICY IF EXISTS "coupons_update_all" ON coupons;

-- Read: anyone with the app key can list coupons.
CREATE POLICY "coupons_select_all" ON coupons
  FOR SELECT
  USING (true);

-- Insert: allow generating coupons.
CREATE POLICY "coupons_insert_all" ON coupons
  FOR INSERT
  WITH CHECK (true);

-- Update: allow marking coupons used, etc.
CREATE POLICY "coupons_update_all" ON coupons
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

SELECT 'coupons RLS read/write policies ready' AS result;
