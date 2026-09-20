-- Issue a DMC number without sending the result to the Print tab.
--
-- add_result_print_flow.sql allocated the number only when a result was
-- forwarded for printing. But the Statement of Marks is printed from the
-- Result section too, and before forwarding it had no number to show — the
-- Dmc No. line came out blank.
--
-- The two acts are separated here: this issues the number (once, from the
-- same register), while forward_result_to_print() continues to decide what
-- appears in the Print tab. Printing an official copy therefore stamps a
-- number without silently queueing the result for printing.
--
-- Idempotent: a result that already has a number gets that same number back.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- (Run add_result_print_flow.sql first — it creates dmc_no_seq.)

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

  r.dmc_no := nextval('dmc_no_seq');
  UPDATE student_results SET dmc_no = r.dmc_no WHERE id = p_result;
  RETURN r.dmc_no;
END $$;

REVOKE ALL ON FUNCTION issue_dmc_no(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_dmc_no(uuid) TO authenticated;

SELECT 'issue_dmc_no() ready' AS result;
