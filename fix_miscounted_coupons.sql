-- ============================================================
-- Undo a coupon batch minted at the wrong denomination.
-- Run in Supabase -> SQL Editor. STEP 1 changes nothing.
--
-- WHAT HAPPENED
--   The Generate Coupons form took ONE number, "Per Coupon Rate", and worked
--   the count out as wallet ÷ rate. Meaning to make 25 coupons of ₹1,000, the
--   admin typed 25 — and a ₹25,000 wallet minted 1,000 coupons of ₹25.
--   The form now asks for the count and the value separately, so this cannot
--   recur; this script clears up the batch that was already made.
--
-- WHAT IT DOES
--   Deletes the mis-minted coupons and returns exactly their face value to the
--   centre's coupon_wallet_balance — so the money is back where it was and can
--   be minted again correctly.
--
-- WHAT IT REFUSES TO TOUCH
--   Any coupon that is used, activated, carries a payment reference, or is
--   attached to an application. Those represent real activity; deleting one
--   would destroy a record and hand back money that has already been spent.
-- ============================================================

-- ------------------------------------------------------------
-- Edit these three lines to describe the batch, then run STEP 1.
--   :code  the centre
--   :value the wrong denomination that was minted
--   :day   the date the batch was created (YYYY-MM-DD), or NULL for any day
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_miscounted_coupons AS
SELECT
  c.id, c.coupon_code, c.face_value, c.created_at,
  ctr.center_name, ctr.center_code, ctr.coupon_wallet_balance,
  -- Anything true here means the coupon is in use and must survive.
  (COALESCE(c.is_used, false)
     OR COALESCE(c.is_activated, false)
     OR c.used_at IS NOT NULL
     OR c.payment_txn_id IS NOT NULL
     OR c.application_id IS NOT NULL)                    AS in_use
FROM coupons c
JOIN centers ctr ON ctr.id = c.center_id
WHERE ctr.center_code = 'SIU002'                          -- :code
  AND c.face_value    = 25                                -- :value
  AND c.created_at::date = DATE '2026-08-04';             -- :day

-- ============================================================
-- STEP 1 — what would happen. Nothing is changed.
-- ============================================================
SELECT
  center_name,
  center_code,
  COUNT(*)                                   AS matched_total,
  COUNT(*) FILTER (WHERE NOT in_use)         AS will_delete,
  COUNT(*) FILTER (WHERE in_use)             AS kept_in_use,
  SUM(face_value) FILTER (WHERE NOT in_use)  AS money_returned,
  MAX(coupon_wallet_balance)                 AS wallet_now,
  MAX(coupon_wallet_balance)
    + COALESCE(SUM(face_value) FILTER (WHERE NOT in_use), 0) AS wallet_after
FROM v_miscounted_coupons
GROUP BY center_name, center_code;

-- Read `kept_in_use` before going on. It should normally be 0 — anything above
-- zero means part of the batch has already been handed out, and that part stays.

-- ============================================================
-- STEP 2 — apply. Uncomment and run once STEP 1 reads correctly.
-- One transaction: the wallet is credited with exactly what was deleted.
-- ============================================================
/*
BEGIN;

WITH doomed AS (
  SELECT id, face_value FROM v_miscounted_coupons WHERE NOT in_use
),
refund AS (
  SELECT COALESCE(SUM(face_value), 0) AS amount FROM doomed
),
gone AS (
  DELETE FROM coupons WHERE id IN (SELECT id FROM doomed) RETURNING 1
)
UPDATE centers
SET coupon_wallet_balance = COALESCE(coupon_wallet_balance, 0) + (SELECT amount FROM refund)
WHERE center_code = 'SIU002';

-- Confirm: the batch should be gone and the wallet back up.
SELECT center_name, center_code, coupon_wallet_balance FROM centers WHERE center_code = 'SIU002';
SELECT COUNT(*) AS still_there FROM v_miscounted_coupons;

COMMIT;   -- change to ROLLBACK; if either number looks wrong
*/
