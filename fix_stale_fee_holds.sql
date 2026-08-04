-- Top up wallet holds that were taken before the fee calculation was fixed.
--
-- students.fee_held is a SNAPSHOT: the money that left the center's wallet the
-- moment the center forwarded the student. Until now the fee due fell back to
-- the admission semester whenever a session had no Examination Calendar, so a
-- July-2025 PGDCA student was held at Rs 2,000 (one semester) instead of the
-- Rs 4,000 that two semesters' fee requires. Fixing the code does not move the
-- money that was already taken — this script does.
--
-- It recomputes the hold exactly the way the app now does (entry / divide /
-- multiply / multiply2 fee items, due semester from how long the session has
-- been running), and for every student still on hold it:
--   * raises students.fee_held to the correct amount, and
--   * debits the difference from that center's virtual_balance.
--
-- Only shortfalls are corrected. A hold that is already right, or larger than
-- required, is left completely alone — no money is ever refunded here.
--
-- Sessions that DO have Examination Calendar rows are skipped: their dates are
-- authoritative and are not second-guessed by elapsed time.
--
-- HOW TO RUN: paste into Supabase -> SQL Editor. Run STEP 1 first and read the
-- preview. Only if it looks right, run STEP 2.

-- NO PERMANENT VIEW IS LEFT BEHIND. This script first shipped with a plain
-- CREATE VIEW, and a Postgres view runs with its OWNER's rights unless told
-- otherwise — so it served students and centres to anon over the REST API and
-- quietly undid the RLS that security_hardening.sql and student_auth.sql put
-- there. The DROP clears any copy that version left; TEMP keeps the new one
-- inside this session, where PostgREST cannot reach it at all.
DROP VIEW IF EXISTS v_fee_hold_shortfall;

-- ------------------------------------------------------------------
-- The shared calculation. Both steps below select from this.
-- Being TEMP it lives only for this session, so STEP 1 and STEP 2 must be run
-- in the SAME SQL editor session.
-- ------------------------------------------------------------------
CREATE OR REPLACE TEMP VIEW v_fee_hold_shortfall AS
WITH totals AS (
  SELECT fs.program_id, fs.session_id,
    COALESCE(SUM(fi.amount) FILTER (WHERE fi.category = 'entry'),     0) AS entry_t,
    COALESCE(SUM(fi.amount) FILTER (WHERE fi.category = 'divide'),    0) AS divide_t,
    COALESCE(SUM(fi.amount) FILTER (WHERE fi.category = 'multiply'),  0) AS mul_t,
    COALESCE(SUM(fi.amount) FILTER (WHERE fi.category = 'multiply2'), 0) AS mul2_t
  FROM fee_structures fs
  LEFT JOIN fee_items fi ON fi.fee_structure_id = fs.id
  GROUP BY fs.program_id, fs.session_id
),
base AS (
  SELECT
    s.id, s.admission_number, s.student_name, s.center_id,
    s.fee_held::numeric              AS held,
    COALESCE(s.coupon_discount, 0)::numeric AS discount,
    c.center_name,
    c.virtual_balance::numeric       AS balance,
    p.program_name,
    GREATEST(COALESCE(p.duration, 1), 1)                          AS total_sems,
    -- "1st Sem" / "2nd Year" -> 1 / 2
    GREATEST(COALESCE(NULLIF(regexp_replace(COALESCE(s.semester_year, ''), '\D', '', 'g'), '')::int, 1), 1) AS entry_unit,
    p.semester_year = 'Year'                                      AS year_mode,
    p.program_name ~* '(ph\.?\s*d|doctor of philosophy|doctoral|doctorate)' AS is_phd,
    -- months the session has been running (2629800s = one average month)
    EXTRACT(EPOCH FROM (now()::timestamp - ses.start_date::timestamp)) / 2629800.0 AS months,
    t.entry_t, t.divide_t, t.mul_t, t.mul2_t,
    EXISTS (SELECT 1 FROM exam_calendar ec WHERE ec.session_id = s.session_id) AS has_calendar
  FROM students s
  JOIN programs p            ON p.id   = s.programme_id
  JOIN academic_sessions ses ON ses.id = s.session_id
  JOIN centers c             ON c.id   = s.center_id
  JOIN totals t              ON t.program_id = s.programme_id AND t.session_id = s.session_id
  WHERE COALESCE(s.fee_held, 0) > 0
    AND ses.start_date IS NOT NULL
),
resolved AS (
  SELECT b.*,
    -- Year-based non-PhD programmes are billed a whole year (2 semesters) up
    -- front; everything else follows the elapsed session, floored at the entry
    -- semester so a lateral entrant is never billed downwards.
    CASE WHEN b.year_mode AND NOT b.is_phd
      THEN LEAST(b.entry_unit * 2, b.total_sems)
      ELSE LEAST(GREATEST(
             CASE WHEN b.months <= 0 THEN 1
                  ELSE (FLOOR((b.months - 0.5) / 6) + 1)::int END,
             LEAST(b.entry_unit, b.total_sems)), b.total_sems)
    END::int AS due_sem
  FROM base b
)
SELECT
  r.id, r.admission_number, r.student_name, r.center_id, r.center_name,
  r.program_name, r.total_sems, r.due_sem, r.balance, r.held, r.has_calendar,
  ROUND(r.entry_t + (r.divide_t / r.total_sems) * r.due_sem
        + r.mul_t * r.due_sem + r.mul2_t * GREATEST(r.due_sem - 1, 0)) AS course_fee,
  GREATEST(CEIL(
    ROUND(r.entry_t + (r.divide_t / r.total_sems) * r.due_sem
          + r.mul_t * r.due_sem + r.mul2_t * GREATEST(r.due_sem - 1, 0)) * 0.5
  ) - r.discount, 0) AS required_hold,
  GREATEST(GREATEST(CEIL(
    ROUND(r.entry_t + (r.divide_t / r.total_sems) * r.due_sem
          + r.mul_t * r.due_sem + r.mul2_t * GREATEST(r.due_sem - 1, 0)) * 0.5
  ) - r.discount, 0) - r.held, 0) AS shortfall
FROM resolved r;

-- ==================================================================
-- STEP 1 — PREVIEW. Nothing is changed. Read this before running STEP 2.
-- ==================================================================
SELECT admission_number, student_name, center_name, program_name,
       due_sem || ' of ' || total_sems AS semesters_due,
       course_fee, held AS held_now, required_hold, shortfall,
       CASE WHEN has_calendar THEN 'skipped — session has an exam calendar'
            WHEN shortfall > 0 THEN 'will be topped up'
            ELSE 'already correct' END AS action
FROM v_fee_hold_shortfall
ORDER BY shortfall DESC, admission_number;

-- What each center's wallet actually pays. (The per-student rows above cannot
-- show this: one center usually owes for several students at once.)
SELECT center_name,
       COUNT(*)          AS students_topped_up,
       SUM(shortfall)    AS total_to_debit,
       MAX(balance)      AS wallet_now,
       MAX(balance) - SUM(shortfall) AS wallet_after
FROM v_fee_hold_shortfall
WHERE shortfall > 0 AND NOT has_calendar
GROUP BY center_id, center_name
ORDER BY center_name;

-- ==================================================================
-- STEP 2 — APPLY. Uncomment the block below and run it.
-- Raises fee_held to the required amount and debits the difference from
-- each center's wallet, both inside one transaction.
-- ==================================================================
/*
BEGIN;

WITH fixable AS (
  SELECT id, center_id, required_hold, shortfall
  FROM v_fee_hold_shortfall
  WHERE shortfall > 0 AND NOT has_calendar
),
debit AS (
  SELECT center_id, SUM(shortfall) AS owed FROM fixable GROUP BY center_id
),
w AS (
  UPDATE centers c SET virtual_balance = c.virtual_balance - d.owed
  FROM debit d WHERE c.id = d.center_id
  RETURNING c.id, c.center_name, c.virtual_balance, d.owed
)
UPDATE students s SET fee_held = f.required_hold
FROM fixable f WHERE s.id = f.id;

-- Confirm: every remaining shortfall should now be 0.
SELECT admission_number, student_name, held, required_hold, shortfall
FROM v_fee_hold_shortfall ORDER BY admission_number;

COMMIT;   -- change to ROLLBACK; if the numbers above look wrong
*/
