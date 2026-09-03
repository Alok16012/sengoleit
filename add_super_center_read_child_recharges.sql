-- ============================================================
-- FIX: Super Center cannot see its centers' recharge history
-- ------------------------------------------------------------
-- Problem: security_hardening.sql gave recharge_requests exactly two
-- read paths — admin, or "center_id is MY OWN centre row". A super
-- centre reading its children therefore gets back nothing.
--
-- And RLS denies by returning ZERO ROWS, not an error, so the Wallet
-- Summary showed an empty "My Centers' Recharge History" with nothing
-- to say anything had gone wrong. The giveaway was Available Balance
-- ₹250 (read from `centers`, which DOES have a super-centre policy)
-- sitting next to Total Balance ₹0 and Total Requests 0.
--
-- Fix: the same shape as fix_super_center_read_children.sql — resolve
-- the child ids through a SECURITY DEFINER helper so the policy does
-- not re-trigger RLS on `centers` and recurse.
--
-- Read-only. A super centre still cannot file, edit or verify a child's
-- recharge; only the centre itself and the Account Dept can.
--
-- Depends on my_super_center_id() from fix_super_center_read_children.sql.
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run.
-- ============================================================

-- Helper: the centre ids under my super centre, bypassing RLS.
CREATE OR REPLACE FUNCTION my_child_center_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM centers WHERE super_center_id = my_super_center_id()
$$;

-- Allow a super centre to READ its children's recharge requests.
DROP POLICY IF EXISTS recharge_super_center_children ON recharge_requests;
CREATE POLICY recharge_super_center_children ON recharge_requests
  FOR SELECT TO authenticated
  USING (center_id IN (SELECT * FROM my_child_center_ids()));

-- Verify: as the logged-in super centre this returns its children's rows.
-- Run from the SQL Editor it returns 0 (you are not a centre) — that is fine,
-- the real check is the Wallet Summary page.
SELECT 'super centre can now read child recharges' AS result,
       count(*) AS child_recharge_rows_visible_to_admin
FROM recharge_requests
WHERE center_id IN (SELECT id FROM centers WHERE super_center_id IS NOT NULL);
