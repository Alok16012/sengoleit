-- ============================================================
-- SECURITY HARDENING — run once in Supabase -> SQL Editor.
-- Safe to re-run. Fixes the holes found in the 2026-08-01 audit:
--
--   1. coupons had NO row-level security — anyone with the anon key could
--      mint or edit coupons straight through the REST API (verified live).
--   2. A center could rewrite its own wallet columns (virtual_balance,
--      coupon_wallet_balance) because its self-row policy was FOR ALL.
--   3. letter_settings / letter_refs / exam_calendar / recharge_requests
--      were writable by ANY authenticated user (i.e. every center login),
--      not just university admins.
--
-- NOTE: rotate the service_role key in Settings -> API as well — the old
-- one shipped inside the public JS bundle and must be treated as leaked.
-- ============================================================

-- Helper: is the calling user a university admin?
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
$$;

-- ------------------------------------------------------------
-- 1) coupons — lock the table down.
--    Admin: full access. Centers: read their own coupons only.
--    Reservation during student entry keeps working through the
--    reserve_coupon() SECURITY DEFINER function, which bypasses RLS.
--
--    Policies are OR'd, so any permissive policy created earlier in the
--    dashboard would keep the table writable no matter what we add here —
--    drop EVERY existing policy on it first (verified live: an anon INSERT
--    still passed RLS after the first version of this script).
-- ------------------------------------------------------------
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coupons' LOOP
    EXECUTE format('DROP POLICY %I ON coupons', p.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS coupons_admin_all ON coupons;
CREATE POLICY coupons_admin_all ON coupons
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS coupons_center_read_own ON coupons;
CREATE POLICY coupons_center_read_own ON coupons
  FOR SELECT TO authenticated USING (
    center_id IN (SELECT id FROM centers WHERE email = (auth.jwt() ->> 'email'))
  );

-- ------------------------------------------------------------
-- 2) centers — money columns are admin-only.
--    RLS cannot compare OLD vs NEW, so a trigger guards the columns:
--    a non-admin update that changes a wallet column is rejected.
--    Admin approvals / recharges keep working unchanged.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_center_money() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- service_role and SQL-editor sessions have no auth.uid(); let them through.
  IF auth.uid() IS NULL OR is_admin() THEN RETURN NEW; END IF;
  IF NEW.virtual_balance IS DISTINCT FROM OLD.virtual_balance
     OR NEW.coupon_wallet_balance IS DISTINCT FROM OLD.coupon_wallet_balance THEN
    RAISE EXCEPTION 'Wallet balances can only be changed by the university admin.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_center_money ON centers;
CREATE TRIGGER trg_guard_center_money
  BEFORE UPDATE ON centers
  FOR EACH ROW EXECUTE FUNCTION guard_center_money();

-- ------------------------------------------------------------
-- 3) letter_settings / letter_refs — reads stay open (portals print the
--    shared Ref. No.), writes become admin-only.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS letter_settings_all_authenticated ON letter_settings;
DROP POLICY IF EXISTS letter_settings_admin_write ON letter_settings;
CREATE POLICY letter_settings_admin_write ON letter_settings
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS letter_settings_read_authenticated ON letter_settings;
CREATE POLICY letter_settings_read_authenticated ON letter_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS letter_refs_all_authenticated ON letter_refs;
DROP POLICY IF EXISTS letter_refs_admin_write ON letter_refs;
CREATE POLICY letter_refs_admin_write ON letter_refs
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS letter_refs_read_authenticated ON letter_refs;
CREATE POLICY letter_refs_read_authenticated ON letter_refs
  FOR SELECT TO authenticated USING (true);

-- (the anon read policies from add_letter_settings.sql stay as they are —
--  the student portal needs them until students get real logins)

-- ------------------------------------------------------------
-- 4) exam_calendar — read for everyone signed in, write for admins.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS exam_calendar_all_authenticated ON exam_calendar;
DROP POLICY IF EXISTS exam_calendar_admin_write ON exam_calendar;
CREATE POLICY exam_calendar_admin_write ON exam_calendar
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS exam_calendar_read_authenticated ON exam_calendar;
CREATE POLICY exam_calendar_read_authenticated ON exam_calendar
  FOR SELECT TO authenticated USING (true);
-- The student portal runs as `anon` (its own session, not Supabase Auth) and
-- prints these dates on the admit card — without this the dates silently
-- vanish there. Exam schedules are public information, not personal data.
DROP POLICY IF EXISTS exam_calendar_read_anon ON exam_calendar;
CREATE POLICY exam_calendar_read_anon ON exam_calendar
  FOR SELECT TO anon USING (true);

-- ------------------------------------------------------------
-- 5) recharge_requests — a center sees and files its own requests;
--    only admins decide them (or touch other centers' rows).
--    Same story as coupons: clear every pre-existing policy first.
-- ------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'recharge_requests' LOOP
    EXECUTE format('DROP POLICY %I ON recharge_requests', p.policyname);
  END LOOP;
END $$;
ALTER TABLE recharge_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recharge_admin_all ON recharge_requests;
CREATE POLICY recharge_admin_all ON recharge_requests
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS recharge_center_own ON recharge_requests;
CREATE POLICY recharge_center_own ON recharge_requests
  FOR SELECT TO authenticated USING (
    center_id IN (SELECT id FROM centers WHERE email = (auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS recharge_center_insert_own ON recharge_requests;
CREATE POLICY recharge_center_insert_own ON recharge_requests
  FOR INSERT TO authenticated WITH CHECK (
    is_admin() OR center_id IN (SELECT id FROM centers WHERE email = (auth.jwt() ->> 'email'))
  );

SELECT 'security hardening applied' AS result;
