-- ============================================================
-- Undo the coupon batch minted at the wrong denomination.
-- Paste the WHOLE file into Supabase -> SQL Editor and run it once.
-- Nothing to uncomment.
--
-- WHAT HAPPENED
--   The Generate Coupons form took ONE number, "Per Coupon Rate", and worked
--   the count out as wallet ÷ rate. Meaning to make 25 coupons of ₹1,000, the
--   admin typed 25 — and a ₹25,000 wallet minted 1,000 coupons of ₹25.
--   The form now asks for the count and the value separately, so this cannot
--   recur; this clears up the batch that was already made.
--
-- WHAT IT DOES
--   Deletes the mis-minted coupons and returns exactly their face value to the
--   centre's coupon_wallet_balance, in ONE transaction — the money and the
--   rows can never disagree.
--
-- WHAT IT REFUSES TO TOUCH
--   Any coupon that is used, activated, carries a payment reference, or is
--   attached to an application. Those represent real activity: deleting one
--   would destroy a record and hand back money that has already been spent.
--
-- SAFE TO RUN TWICE. The second run finds nothing to delete and therefore
--   refunds ₹0 — it cannot double-credit the wallet.
--
-- NO VIEW IS LEFT BEHIND. An earlier version of this script created
--   v_miscounted_coupons. A Postgres view runs with its OWNER's rights unless
--   told otherwise, and PostgREST serves everything in `public` — so that view
--   handed the whole coupons table to the anon key and undid the RLS that
--   security_hardening.sql had put there. The DROP below removes it.
-- ============================================================

DROP VIEW IF EXISTS v_miscounted_coupons;

-- ------------------------------------------------------------
-- Change these three values if you ever reuse this for another batch.
--   'SIU002'      the centre        (Rajesh Study Center)
--   25            the wrong value that was minted
--   '2026-08-04'  the day the batch was created
-- ------------------------------------------------------------

-- BEFORE
SELECT 'BEFORE' AS stage, ctr.center_name, ctr.coupon_wallet_balance AS wallet,
       COUNT(*) AS coupons_in_batch
FROM coupons c JOIN centers ctr ON ctr.id = c.center_id
WHERE ctr.center_code = 'SIU002' AND c.face_value = 25
  AND c.created_at::date = DATE '2026-08-04'
GROUP BY ctr.center_name, ctr.coupon_wallet_balance;

BEGIN;

WITH doomed AS (
  SELECT c.id, c.face_value
  FROM coupons c
  JOIN centers ctr ON ctr.id = c.center_id
  WHERE ctr.center_code    = 'SIU002'
    AND c.face_value       = 25
    AND c.created_at::date = DATE '2026-08-04'
    -- Leave anything that is already in play.
    AND NOT (COALESCE(c.is_used, false)
             OR COALESCE(c.is_activated, false)
             OR c.used_at IS NOT NULL
             OR c.payment_txn_id IS NOT NULL
             OR c.application_id IS NOT NULL)
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

COMMIT;

-- AFTER — the wallet should be back up, and `coupons_left` should be 0
-- (or only the ones that were already used / activated / paid).
SELECT 'AFTER' AS stage, ctr.center_name, ctr.coupon_wallet_balance AS wallet,
       (SELECT COUNT(*)
          FROM coupons c2
         WHERE c2.center_id = ctr.id AND c2.face_value = 25
           AND c2.created_at::date = DATE '2026-08-04') AS coupons_left
FROM centers ctr
WHERE ctr.center_code = 'SIU002';
