-- A separate DMC number series for each semester.
--
-- Until now every DMC number came off one register, dmc_no_seq, so a Sem 1
-- result and a Sem 2 result drew from the same run. Each semester now has
-- its own series, and the number a result gets depends on its semester:
-- Sem 1 results count 11100, 11101 …, Sem 2 results 21100, 21101 … — the
-- first digit tells you the semester at a glance.
--
-- The two functions that issue numbers — forward_result_to_print() and
-- issue_dmc_no() — are otherwise unchanged: a result that already has a
-- number keeps it, and forwarding or printing again never draws a new one.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run: the starting numbers
-- below are only written the first time, never over a series in use.
-- (add_result_print_flow.sql and add_issue_dmc_no.sql must have been run.)
-- ============================================================

-- ── The series. EDIT THE STARTING NUMBERS HERE BEFORE THE FIRST RUN. ──
CREATE TABLE IF NOT EXISTS dmc_series (
  semester int    PRIMARY KEY,
  next_no  bigint NOT NULL        -- the number the next result of this semester gets
);

INSERT INTO dmc_series (semester, next_no) VALUES
  (1,  11100),
  (2,  21100),
  (3,  31100),
  (4,  41100),
  (5,  51100),
  (6,  61100),
  (7,  71100),
  (8,  81100),
  (9,  91100),
  (10, 101100)
ON CONFLICT (semester) DO NOTHING;

-- Read and written only through the functions below.
ALTER TABLE dmc_series ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Take the next number of one semester's series. The UPDATE ... RETURNING
-- is a single statement, so two results sent at the same moment can never
-- be handed the same number.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION next_dmc_no(p_semester int)
RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint;
BEGIN
  UPDATE dmc_series SET next_no = next_no + 1
   WHERE semester = p_semester
  RETURNING next_no - 1 INTO n;
  IF n IS NULL THEN
    RAISE EXCEPTION 'No DMC number series is set up for semester %. Add it to dmc_series.', p_semester;
  END IF;
  RETURN n;
END $$;

-- Internal: called only from the two functions below, never from the app.
REVOKE ALL ON FUNCTION next_dmc_no(int) FROM PUBLIC;

-- ------------------------------------------------------------
-- Forward to the Print tab — as before, but the number comes from the
-- result's own semester series.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION forward_result_to_print(p_result uuid)
RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r student_results%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can send a result for printing.';
  END IF;

  SELECT * INTO r FROM student_results WHERE id = p_result FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Result not found.'; END IF;

  IF r.declared_at IS NULL OR COALESCE(r.status, 'Pending') = 'Pending' THEN
    RAISE EXCEPTION 'This result has not been declared yet.';
  END IF;

  IF r.dmc_no IS NULL THEN
    r.dmc_no := next_dmc_no(r.semester);
  END IF;

  UPDATE student_results
     SET dmc_no = r.dmc_no,
         print_forwarded_at = COALESCE(print_forwarded_at, now())
   WHERE id = p_result;

  RETURN r.dmc_no;
END $$;

-- ------------------------------------------------------------
-- Number a result when its Statement is printed without forwarding it.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION issue_dmc_no(p_result uuid)
RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r student_results%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can issue a DMC number.';
  END IF;

  SELECT * INTO r FROM student_results WHERE id = p_result FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Result not found.'; END IF;
  IF r.declared_at IS NULL OR COALESCE(r.status, 'Pending') = 'Pending' THEN
    RAISE EXCEPTION 'This result has not been declared yet.';
  END IF;

  IF r.dmc_no IS NOT NULL THEN RETURN r.dmc_no; END IF;

  r.dmc_no := next_dmc_no(r.semester);
  UPDATE student_results SET dmc_no = r.dmc_no WHERE id = p_result;
  RETURN r.dmc_no;
END $$;

REVOKE ALL ON FUNCTION forward_result_to_print(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION issue_dmc_no(uuid)            FROM PUBLIC;
GRANT EXECUTE ON FUNCTION forward_result_to_print(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION issue_dmc_no(uuid)            TO authenticated;

SELECT semester, next_no AS next_dmc_number FROM dmc_series ORDER BY semester;


-- ============================================================
-- OPTIONAL — numbers already issued from the old single series (10001 …)
-- stay on their results; only new numbers follow the semester series.
--
-- To renumber those too, first see what is there (read-only):
--   SELECT st.enrollment_no, st.student_name, r.semester, r.dmc_no
--   FROM student_results r JOIN students st ON st.id = r.student_id
--   WHERE r.dmc_no IS NOT NULL ORDER BY r.semester, r.dmc_no;
--
-- Then, ONLY if none of those marksheets has been printed and handed out
-- (a number must never end up on two sheets), clear them so they are
-- issued again from the right series when sent to Print:
--
-- BEGIN;
-- UPDATE student_results SET dmc_no = NULL, print_forwarded_at = NULL
--  WHERE dmc_no IS NOT NULL OR print_forwarded_at IS NOT NULL;
-- COMMIT;
-- ============================================================
