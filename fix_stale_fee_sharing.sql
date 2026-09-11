-- ============================================================
-- Re-price students still carrying an old fee-sharing rate
-- ------------------------------------------------------------
-- students.fee_sharing_pct is stamped when the admission is SUBMITTED and the
-- money is taken against that stamp, so changing a centre's Fee Sharing does
-- not touch students already stamped at the old rate. That is deliberate — it
-- stops a rate change re-pricing a centre's whole history — but it leaves
-- students submitted just before a change sitting on the old number.
--
-- This brings a centre's stamped students onto its CURRENT rate and returns
-- the difference to its wallet.
--
-- HOW THE NEW FIGURE IS WORKED OUT
--   What was taken is  ceil(gross x (100 - old) / 100 x 0.5) - discount.
--   Rather than rebuild `gross` — which needs the exam calendar to know how
--   many semesters were due — the amount is scaled:
--       new = ceil((old_amount + discount) x (100 - new) / (100 - old)) - discount
--   For 50% -> 60% that is x 0.8: 5,375 becomes 4,300, the same figure a fresh
--   admission at 60% produces. Because the stored number was already rounded
--   once, a course whose fee does not divide cleanly can land 1 rupee away from
--   what a fresh calculation would give. Check the preview before running.
--
-- Run in Supabase -> SQL Editor. STEP 1 IS READ-ONLY — run it first.
-- ============================================================

-- ── STEP 1: preview. Change the centre code, run, and read the numbers. ──
WITH target AS (
  SELECT id, center_name, fee_sharing
  FROM centers
  WHERE center_code = 'SIU015'          -- <<< the centre to correct
)
SELECT s.admission_number,
       s.student_name,
       s.status,
       s.fee_sharing_pct                      AS old_pct,
       t.fee_sharing                          AS new_pct,
       s.fee_collected                        AS old_collected,
       CASE WHEN COALESCE(s.fee_collected, 0) > 0 THEN
         ceil((s.fee_collected + COALESCE(s.coupon_discount, 0))
              * (100 - t.fee_sharing)::numeric / (100 - s.fee_sharing_pct)::numeric)
         - COALESCE(s.coupon_discount, 0) END AS new_collected,
       s.fee_held                             AS old_held,
       CASE WHEN COALESCE(s.fee_held, 0) > 0 THEN
         ceil((s.fee_held + COALESCE(s.coupon_discount, 0))
              * (100 - t.fee_sharing)::numeric / (100 - s.fee_sharing_pct)::numeric)
         - COALESCE(s.coupon_discount, 0) END AS new_held
FROM students s
JOIN target t ON t.id = s.center_id
WHERE s.fee_sharing_pct IS NOT NULL
  AND t.fee_sharing IS NOT NULL
  AND s.fee_sharing_pct <> t.fee_sharing
  AND s.fee_sharing_pct < 100          -- guard: (100 - old) must not be zero
ORDER BY s.admission_number;

-- The total that will go back to the centre's wallet:
-- WITH target AS (SELECT id, fee_sharing FROM centers WHERE center_code = 'SIU015')
-- SELECT sum(
--          (COALESCE(s.fee_collected,0) - COALESCE(ceil((s.fee_collected + COALESCE(s.coupon_discount,0))
--             * (100 - t.fee_sharing)::numeric / (100 - s.fee_sharing_pct)::numeric) - COALESCE(s.coupon_discount,0), 0))
--        + (COALESCE(s.fee_held,0) - COALESCE(ceil((s.fee_held + COALESCE(s.coupon_discount,0))
--             * (100 - t.fee_sharing)::numeric / (100 - s.fee_sharing_pct)::numeric) - COALESCE(s.coupon_discount,0), 0))
--        ) AS refund_to_wallet
-- FROM students s JOIN target t ON t.id = s.center_id
-- WHERE s.fee_sharing_pct IS NOT NULL AND t.fee_sharing IS NOT NULL
--   AND s.fee_sharing_pct <> t.fee_sharing AND s.fee_sharing_pct < 100;


-- ── STEP 2: the correction. Uncomment and run only after the preview reads
--    right. One transaction — students, the ledger and the wallet move
--    together or not at all.
/*
BEGIN;

CREATE TEMP TABLE repriced ON COMMIT DROP AS
WITH target AS (
  SELECT id, fee_sharing FROM centers WHERE center_code = 'SIU015'   -- <<< same centre
)
SELECT s.id                                   AS student_id,
       s.center_id,
       t.fee_sharing                          AS new_pct,
       COALESCE(s.fee_collected, 0)           AS old_collected,
       CASE WHEN COALESCE(s.fee_collected, 0) > 0 THEN
         ceil((s.fee_collected + COALESCE(s.coupon_discount, 0))
              * (100 - t.fee_sharing)::numeric / (100 - s.fee_sharing_pct)::numeric)
         - COALESCE(s.coupon_discount, 0) ELSE 0 END AS new_collected,
       COALESCE(s.fee_held, 0)                AS old_held,
       CASE WHEN COALESCE(s.fee_held, 0) > 0 THEN
         ceil((s.fee_held + COALESCE(s.coupon_discount, 0))
              * (100 - t.fee_sharing)::numeric / (100 - s.fee_sharing_pct)::numeric)
         - COALESCE(s.coupon_discount, 0) ELSE 0 END AS new_held
FROM students s
JOIN target t ON t.id = s.center_id
WHERE s.fee_sharing_pct IS NOT NULL
  AND t.fee_sharing IS NOT NULL
  AND s.fee_sharing_pct <> t.fee_sharing
  AND s.fee_sharing_pct < 100;

-- The student now reads the new rate and the new amounts.
UPDATE students s
   SET fee_sharing_pct = r.new_pct,
       fee_collected   = CASE WHEN r.old_collected > 0 THEN r.new_collected ELSE s.fee_collected END,
       fee_held        = CASE WHEN r.old_held      > 0 THEN r.new_held      ELSE s.fee_held      END
  FROM repriced r
 WHERE s.id = r.student_id;

-- The Payment Summary line has to agree with what was actually kept, or the
-- two screens tell different stories about the same money.
UPDATE student_fee_ledger l
   SET amount = r.new_collected,
       note   = COALESCE(l.note, '') || ' (re-priced to ' || r.new_pct || '% sharing)'
  FROM repriced r
 WHERE l.student_id = r.student_id
   AND l.kind = 'admission'
   AND r.old_collected > 0;

-- What the centre over-paid goes back.
UPDATE centers c
   SET virtual_balance = c.virtual_balance + x.refund
  FROM (SELECT center_id,
               sum((old_collected - new_collected) + (old_held - new_held)) AS refund
          FROM repriced GROUP BY center_id) x
 WHERE c.id = x.center_id
   AND x.refund <> 0;

SELECT count(*) AS students_repriced,
       sum((old_collected - new_collected) + (old_held - new_held)) AS refunded_to_wallet
FROM repriced;

COMMIT;
*/
