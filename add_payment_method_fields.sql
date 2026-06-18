-- ============================================================
-- Account Dept payment flow — method, UTR & tracking reference
-- ------------------------------------------------------------
-- After Document Dept verification, the Account Dept settles the
-- letter fee one of two ways:
--
--   1. Manual / UTR  — money already received offline. Admin enters
--      the UTR, verifies the receipt, and marks it paid. ID/password
--      and coupon wallet deposit happen on approval.
--
--   2. Payment Link  — money not yet received. Admin generates a
--      Razorpay link, then a Reference Number. The center tracks its
--      application on the university website using email + reference
--      number, and pays from the link shown there.
--
-- This adds the columns those flows write to.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS payment_method       text,   -- 'manual' | 'link'
  ADD COLUMN IF NOT EXISTS payment_reference_no text,   -- tracking ref for the public site
  ADD COLUMN IF NOT EXISTS utr_number           text;   -- manual UTR / txn id

-- Look up an application by email + reference number (university website).
CREATE INDEX IF NOT EXISTS centers_payment_reference_no_idx
  ON centers (payment_reference_no);

SELECT 'centers payment_method / payment_reference_no / utr_number ready' AS result;
