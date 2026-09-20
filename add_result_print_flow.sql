-- Printing flow for declared results: a result reaches the Exam Section's
-- Print tab only when it is forwarded from the Result section, and it is
-- given a DMC number at that moment.
--
-- WHY A STORED NUMBER
--   The Statement of Marks printed "<enrollment>/S<sem>" as its Dmc No. That
--   is derived, not issued: it changes if the enrolment number is ever
--   corrected, two reprints could disagree, and there is no register of what
--   has been issued. dmc_no is allocated once, from a sequence starting at
--   10001, and kept on the result row, so a reprint always carries the same
--   number and no number is ever handed out twice.
--
--   Numbers are spent only on results actually sent for printing, so the
--   register has no gaps for results that were merely declared.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

ALTER TABLE student_results ADD COLUMN IF NOT EXISTS print_forwarded_at timestamptz;
ALTER TABLE student_results ADD COLUMN IF NOT EXISTS dmc_no bigint;

-- Two results must never share a number; NULLs are free (not yet issued).
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_results_dmc_no
  ON student_results(dmc_no) WHERE dmc_no IS NOT NULL;

-- The register. MINVALUE is the start, so a restart cannot drop below it.
CREATE SEQUENCE IF NOT EXISTS dmc_no_seq START WITH 10001 MINVALUE 10001;

-- ------------------------------------------------------------
-- Forward one declared result to the Print tab, issuing its DMC number.
--
-- Idempotent on purpose: forwarding again returns the number already issued
-- rather than burning a fresh one, so a double click cannot advance the
-- register. The row is locked first for the same reason two forwards of one
-- student could once charge a wallet twice.
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

  -- A result still being entered has nothing to print.
  IF r.declared_at IS NULL OR COALESCE(r.status, 'Pending') = 'Pending' THEN
    RAISE EXCEPTION 'This result has not been declared yet.';
  END IF;

  IF r.dmc_no IS NULL THEN
    r.dmc_no := nextval('dmc_no_seq');
  END IF;

  UPDATE student_results
     SET dmc_no = r.dmc_no,
         print_forwarded_at = COALESCE(print_forwarded_at, now())
   WHERE id = p_result;

  RETURN r.dmc_no;
END $$;

-- ------------------------------------------------------------
-- Take a result back out of the Print tab. The DMC number STAYS on the row:
-- once a number has been issued it belongs to that result for good, and
-- reissuing it would put two different sheets into circulation under one
-- number.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION withdraw_result_from_print(p_result uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can withdraw a result from printing.';
  END IF;
  UPDATE student_results SET print_forwarded_at = NULL WHERE id = p_result;
END $$;

REVOKE ALL ON FUNCTION forward_result_to_print(uuid)   FROM PUBLIC;
REVOKE ALL ON FUNCTION withdraw_result_from_print(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION forward_result_to_print(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION withdraw_result_from_print(uuid) TO authenticated;

SELECT 'result print flow ready — DMC numbers start at 10001' AS result;
