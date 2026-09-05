-- ============================================================
-- FIX: a centre could not read its own commission, so it was charged the
--      full course fee
-- ------------------------------------------------------------
-- The course fee a centre owes is now
--     fee due x (100 - its commission%) / 100
-- and that percentage is read from center_commissions.
--
-- add_commission_recipients.sql gave that table two read paths: the admin, and
-- the SUPER centre being paid. The centre itself had none — so the Student
-- Entry page, which runs as the centre, read zero rows, fell back to the
-- legacy centers.commission (empty since the values moved into the table), and
-- worked out a 0% share. The centre saw the whole fee.
--
-- RLS refuses by returning zero rows and NO error, which is why this looked
-- like "the change did not happen" rather than a permission problem.
--
-- Worse than cosmetic: the Account Dept runs as admin and DOES see the
-- commission, so it would have collected the reduced fee the centre was never
-- shown — the two ends disagreeing about the same student.
--
-- Read-only, and only its own rows: a centre still cannot see another centre's
-- rate, and cannot change its own.
--
-- Run in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================

DROP POLICY IF EXISTS center_commissions_own_read ON center_commissions;
CREATE POLICY center_commissions_own_read ON center_commissions
  FOR SELECT TO authenticated
  USING (center_id IN (SELECT id FROM centers WHERE email = (auth.jwt() ->> 'email')));

-- Verify: every policy now on the table.
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'center_commissions'
ORDER BY policyname;
