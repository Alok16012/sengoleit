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
-- HOW THE NEW FIGURES ARE WORKED OUT
--   Every amount is scaled by (100 - new) / (100 - old). For 50% -> 60% that
--   is x 0.8, so a 5,375 admission becomes 4,300 — the same figure a fresh
--   admission at 60% produces. The gross fee is never rebuilt, because that
--   needs the exam calendar to know how many semesters were due.
--
--   fee_collected is NOT scaled directly. It is the SUM of a student's ledger
--   lines — admission + re-registration + exam balance — so each LINE is
--   scaled and fee_collected is set to what they now add up to. Scaling the
--   total on its own would have left the lines disagreeing with it: a student
--   on 10,750 would have shown an 8,600 admission line beside untouched
--   re-registration and exam lines, summing to 13,975.
--
--   A student with no ledger lines at all (records that predate the ledger)
--   falls back to scaling fee_collected itself.
--
-- Run in Supabase -> SQL Editor. STEP 1 IS READ-ONLY — run it first.
-- ============================================================

-- ── STEP 1: preview. Set the centre code, run, read the numbers. ──
WITH target AS (
  SELECT id, center_name, fee_sharing
  FROM centers
  WHERE center_code = 'SIU015'          -- <<< the centre to correct
),
affected AS (
  SELECT s.*, t.fee_sharing AS new_pct,
         (100 - t.fee_sharing)::numeric / (100 - s.fee_sharing_pct)::numeric AS factor
  FROM students s
  JOIN target t ON t.id = s.center_id
  WHERE s.fee_sharing_pct IS NOT NULL
    AND t.fee_sharing IS NOT NULL
    AND s.fee_sharing_pct <> t.fee_sharing
    AND s.fee_sharing_pct < 100        -- guard: (100 - old) must not be zero
),
ledger AS (
  SELECT a.id AS student_id,
         count(l.id)                                  AS lines,
         sum(l.amount)                                AS lines_old,
         sum(round(l.amount * a.factor))              AS lines_new
  FROM affected a
  LEFT JOIN student_fee_ledger l ON l.student_id = a.id
  GROUP BY a.id
)
SELECT a.admission_number,
       a.student_name,
       a.status,
       a.fee_sharing_pct           AS old_pct,
       a.new_pct,
       g.lines                     AS ledger_lines,
       a.fee_collected             AS old_collected,
       CASE WHEN COALESCE(a.fee_collected, 0) = 0 THEN NULL
            WHEN g.lines > 0       THEN g.lines_new
            ELSE round(a.fee_collected * a.factor) END AS new_collected,
       a.fee_held                  AS old_held,
       CASE WHEN COALESCE(a.fee_held, 0) = 0 THEN NULL
            ELSE round(a.fee_held * a.factor) END      AS new_held,
       -- What this student puts back in the wallet.
       COALESCE(a.fee_collected, 0) - COALESCE(
         CASE WHEN COALESCE(a.fee_collected, 0) = 0 THEN 0
              WHEN g.lines > 0 THEN g.lines_new
              ELSE round(a.fee_collected * a.factor) END, 0)
     + COALESCE(a.fee_held, 0) - COALESCE(
         CASE WHEN COALESCE(a.fee_held, 0) = 0 THEN 0
              ELSE round(a.fee_held * a.factor) END, 0)            AS refund
FROM affected a
JOIN ledger g ON g.student_id = a.id
ORDER BY a.admission_number;

-- Sanity check — every student's ledger lines should already add up to their
-- fee_collected. Any row this returns is a student whose books were ALREADY
-- out of step before this script; sort that out first.
-- WITH target AS (SELECT id FROM centers WHERE center_code = 'SIU015')
-- SELECT s.admission_number, s.student_name, s.fee_collected,
--        sum(l.amount) AS ledger_total
-- FROM students s
-- JOIN target t ON t.id = s.center_id
-- JOIN student_fee_ledger l ON l.student_id = s.id
-- GROUP BY s.id, s.admission_number, s.student_name, s.fee_collected
-- HAVING sum(l.amount) <> COALESCE(s.fee_collected, 0);


-- ── STEP 2: the correction. Uncomment and run only after the preview reads
--    right. One transaction — students, their ledger lines and the wallet move
--    together or not at all.
/*
BEGIN;

CREATE TEMP TABLE repriced ON COMMIT DROP AS
WITH target AS (
  SELECT id, fee_sharing FROM centers WHERE center_code = 'SIU015'   -- <<< same centre
),
affected AS (
  SELECT s.id, s.center_id, s.fee_collected, s.fee_held,
         t.fee_sharing AS new_pct,
         (100 - t.fee_sharing)::numeric / (100 - s.fee_sharing_pct)::numeric AS factor
  FROM students s
  JOIN target t ON t.id = s.center_id
  WHERE s.fee_sharing_pct IS NOT NULL
    AND t.fee_sharing IS NOT NULL
    AND s.fee_sharing_pct <> t.fee_sharing
    AND s.fee_sharing_pct < 100
),
ledger AS (
  SELECT a.id AS student_id, count(l.id) AS lines, sum(round(l.amount * a.factor)) AS lines_new
  FROM affected a
  LEFT JOIN student_fee_ledger l ON l.student_id = a.id
  GROUP BY a.id
)
SELECT a.id                          AS student_id,
       a.center_id,
       a.new_pct,
       a.factor,
       COALESCE(a.fee_collected, 0)  AS old_collected,
       CASE WHEN COALESCE(a.fee_collected, 0) = 0 THEN 0
            WHEN g.lines > 0 THEN g.lines_new
            ELSE round(a.fee_collected * a.factor) END AS new_collected,
       COALESCE(a.fee_held, 0)       AS old_held,
       CASE WHEN COALESCE(a.fee_held, 0) = 0 THEN 0
            ELSE round(a.fee_held * a.factor) END      AS new_held
FROM affected a
JOIN ledger g ON g.student_id = a.id;

-- Every line scaled, so the Payment Summary still adds up to fee_collected.
UPDATE student_fee_ledger l
   SET amount = round(l.amount * r.factor),
       note   = COALESCE(l.note, '') || ' (re-priced to ' || r.new_pct || '% sharing)'
  FROM repriced r
 WHERE l.student_id = r.student_id;

-- The student reads the new rate and the new totals.
UPDATE students s
   SET fee_sharing_pct = r.new_pct,
       fee_collected   = CASE WHEN r.old_collected > 0 THEN r.new_collected ELSE s.fee_collected END,
       fee_held        = CASE WHEN r.old_held      > 0 THEN r.new_held      ELSE s.fee_held      END
  FROM repriced r
 WHERE s.id = r.student_id;

-- What the centre over-paid goes back.
UPDATE centers c
   SET virtual_balance = c.virtual_balance + x.refund
  FROM (SELECT center_id,
               sum((old_collected - new_collected) + (old_held - new_held)) AS refund
          FROM repriced GROUP BY center_id) x
 WHERE c.id = x.center_id
   AND x.refund <> 0;

SELECT count(*)                                                            AS students_repriced,
       sum((old_collected - new_collected) + (old_held - new_held))        AS refunded_to_wallet
FROM repriced;

COMMIT;
*/
