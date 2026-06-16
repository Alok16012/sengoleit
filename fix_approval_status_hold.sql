-- ============================================================
-- FIX: "centers_approval_status_check" violation when putting a
--      center On Hold.
-- ------------------------------------------------------------
-- The old CHECK constraint only allowed:
--   pending, doc_verified, approved, rejected
-- but the Document/Account departments now also use 'hold'.
-- The Account Department additionally uses 'account_hold' (a payment-only
-- hold that stays inside the Account Dept, separate from Doc Dept's 'hold').
-- Setting approval_status = 'hold' / 'account_hold' therefore fails.
--
-- Fix: recreate the constraint to include every status the app uses.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

ALTER TABLE centers DROP CONSTRAINT IF EXISTS centers_approval_status_check;

ALTER TABLE centers ADD CONSTRAINT centers_approval_status_check
  CHECK (approval_status IN ('pending', 'doc_verified', 'hold', 'account_hold', 'approved', 'rejected'));

SELECT 'approval_status now allows: pending, doc_verified, hold, account_hold, approved, rejected' AS result;
