-- Take every result back out of the Print tab and start DMC numbering again.
--
-- WHY
--   Results were sent to Print a student at a time, so each student's
--   semesters took consecutive numbers — Sem 1 10036, Sem 2 10037 — instead of
--   each semester's batch keeping its own run. The Result list now sends one
--   semester at a time; this clears what was issued so it can be done again in
--   that order.
--
--   Withdrawing alone would not help: withdraw_result_from_print() keeps the
--   number on the row on purpose, and sending again would hand the same number
--   straight back. So the numbers are cleared and the register restarts at
--   10001.
--
-- BEFORE RUNNING STEP 2
--   A DMC number is meant to be issued once. If any Statement of Marks carrying
--   one of these numbers has already been printed and handed out, restarting
--   the register will give that same number to a different result. Only run
--   step 2 if none has left the office.
--
-- Run in Supabase -> SQL Editor. STEP 1 IS READ-ONLY.
-- ============================================================

-- ── STEP 1: what is there now. Changes nothing. ──
SELECT count(*) FILTER (WHERE print_forwarded_at IS NOT NULL) AS in_print_tab,
       count(*) FILTER (WHERE dmc_no IS NOT NULL)             AS with_dmc_number,
       min(dmc_no)                                            AS lowest_dmc,
       max(dmc_no)                                            AS highest_dmc
FROM student_results;

SELECT last_value AS register_last_issued, is_called FROM dmc_no_seq;

-- Every numbered result, semester by semester — how the numbers were given out.
SELECT st.enrollment_no, st.student_name, r.semester, r.dmc_no,
       (r.print_forwarded_at IS NOT NULL) AS in_print_tab
FROM student_results r
JOIN students st ON st.id = r.student_id
WHERE r.dmc_no IS NOT NULL OR r.print_forwarded_at IS NOT NULL
ORDER BY r.dmc_no NULLS LAST;


-- ── STEP 2: clear and restart. Uncomment and run only after reading step 1. ──
/*
BEGIN;

UPDATE student_results
   SET print_forwarded_at = NULL,
       dmc_no             = NULL
 WHERE print_forwarded_at IS NOT NULL OR dmc_no IS NOT NULL;

-- false = the NEXT number issued is 10001 itself, not 10002.
SELECT setval('dmc_no_seq', 10001, false);

SELECT count(*) FILTER (WHERE print_forwarded_at IS NOT NULL) AS in_print_tab_now,
       count(*) FILTER (WHERE dmc_no IS NOT NULL)             AS numbered_now
FROM student_results;

COMMIT;
*/
