-- ============================================================
-- WALLET DRIFT — what each centre's balance SHOULD be.
-- Run in Supabase -> SQL Editor. STEP 1 changes nothing.
--
-- WHY
--   While guard_center_money() was blocking centre logins, forwarding a student
--   recorded fee_held but the matching debit was rejected — and the app ignored
--   the error, so the money never left the wallet. Rejections, which run as
--   admin, were allowed, so they credited holds that had never been taken.
--   Some balances are therefore too high.
--
--   fix_wallet_writes.sql stops it happening again. This works out what the
--   damage was, from the record the database still has.
--
-- HOW THE EXPECTED BALANCE IS DERIVED
--   verified recharges          (money in)
--   − fee_collected             (money taken for approved admissions)
--   − fee_held still outstanding (money locked against undecided students)
--
--   A centre whose balance was set by hand, or that was seeded with an opening
--   balance, will differ for that reason alone — so this is a REPORT, and the
--   correction in STEP 2 is per-centre and opt-in. Read it before applying.
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1 — the report. Nothing is changed.
-- ------------------------------------------------------------
WITH recharged AS (
  SELECT center_id, COALESCE(SUM(amount), 0) AS money_in
  FROM recharge_requests
  WHERE lower(COALESCE(status, '')) = 'verified'
  GROUP BY center_id
),
collected AS (
  SELECT center_id,
         COALESCE(SUM(fee_collected) FILTER (WHERE status = 'Approved'), 0) AS money_out,
         COALESCE(SUM(fee_held), 0)                                          AS still_held,
         COUNT(*) FILTER (WHERE COALESCE(fee_held, 0) > 0)                    AS held_students
  FROM students
  GROUP BY center_id
)
SELECT
  c.center_name,
  c.center_code,
  c.virtual_balance                          AS balance_now,
  COALESCE(r.money_in, 0)                    AS verified_recharges,
  COALESCE(s.money_out, 0)                   AS collected_from_approvals,
  COALESCE(s.still_held, 0)                  AS currently_held,
  COALESCE(s.held_students, 0)               AS students_on_hold,
  COALESCE(r.money_in, 0) - COALESCE(s.money_out, 0) - COALESCE(s.still_held, 0)
                                             AS balance_expected,
  c.virtual_balance
    - (COALESCE(r.money_in, 0) - COALESCE(s.money_out, 0) - COALESCE(s.still_held, 0))
                                             AS drift
FROM centers c
LEFT JOIN recharged r ON r.center_id = c.id
LEFT JOIN collected s ON s.center_id = c.id
WHERE c.center_type IN ('center', 'super_center')
ORDER BY abs(c.virtual_balance
  - (COALESCE(r.money_in, 0) - COALESCE(s.money_out, 0) - COALESCE(s.still_held, 0))) DESC;

-- `drift` positive  = the wallet holds MORE than the records justify (the usual
--                     case here: a hold that was never debited, or refunded
--                     money that had never been taken).
-- `drift` negative  = the wallet holds LESS — check for a hand adjustment or an
--                     opening balance before touching it.

-- ============================================================
-- STEP 2 — correct ONE centre, once you have read the report.
-- Replace the code and the amount, then run. Deliberately per-centre: there is
-- no safe way to bulk-correct balances that may have legitimate manual history.
-- ============================================================
/*
BEGIN;

UPDATE centers
SET virtual_balance = virtual_balance - 4000     -- the `drift` from STEP 1
WHERE center_code = 'SIU009';

-- Re-read the same row to confirm before committing.
SELECT center_name, center_code, virtual_balance FROM centers WHERE center_code = 'SIU009';

COMMIT;   -- change to ROLLBACK; if the number is not what you expected
*/
