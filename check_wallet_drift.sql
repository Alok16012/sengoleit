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
-- READING THE REPORT — three different situations, three different answers.
--
--  a) drift > 0 AND balance_expected >= 0
--     Money is in the wallet that the records do not justify — a hold that was
--     never debited, or a refund of one. Take the drift off: STEP 2A.
--
--  b) balance_expected < 0
--     More was collected than was ever recorded as recharged, so the centre
--     began with an opening balance that predates recharge_requests. The wallet
--     is not wrong; the report simply cannot see where the money came from.
--     LEAVE IT ALONE.
--
--  c) drift > 0 but verified_recharges = 0
--     Same thing: a balance that arrived by some route other than a recharge
--     request (a registration payment, or one set by hand). LEAVE IT ALONE.
--
-- students_on_hold with a wallet that could not have paid for them is a
-- separate problem — see STEP 2B.
-- ============================================================

-- ------------------------------------------------------------
-- STEP 2A — take the drift off ONE centre. Read STEP 1 first.
-- Per-centre on purpose: balances with manual history must not be bulk-written.
-- ------------------------------------------------------------
/*
BEGIN;

UPDATE centers
SET virtual_balance = virtual_balance - 12000    -- the `drift` from STEP 1
WHERE center_code = 'SIU009';

SELECT center_name, center_code, virtual_balance FROM centers WHERE center_code = 'SIU009';

COMMIT;   -- change to ROLLBACK; if the number is not what you expected
*/

-- ------------------------------------------------------------
-- STEP 2B — a hold that was never actually paid.
--
-- A forwarded student can carry fee_held that never left the wallet (the debit
-- was blocked, and the app did not notice). Refunding it would hand the centre
-- money it never paid; leaving it lets the approval record a fee that was never
-- collected. Clearing it to zero is the honest option: the Account Dept then
-- collects the full amount on approval, and refuses to approve until the
-- centre's wallet can cover it.
--
-- Run the SELECT first and check the students are the ones you expect.
-- ------------------------------------------------------------
SELECT s.admission_number, s.student_name, s.fee_held, c.center_name, c.virtual_balance
FROM students s
JOIN centers c ON c.id = s.center_id
WHERE COALESCE(s.fee_held, 0) > 0
  AND c.virtual_balance < s.fee_held      -- the wallet could not have paid it
ORDER BY c.center_name;

/*
BEGIN;

UPDATE students s
SET fee_held = 0
FROM centers c
WHERE c.id = s.center_id
  AND COALESCE(s.fee_held, 0) > 0
  AND c.virtual_balance < s.fee_held;

COMMIT;   -- or ROLLBACK;
*/
