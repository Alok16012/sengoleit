-- Take back a Ph.D candidate's Registration (Enrollment) No. that was issued
-- before the fee was paid. Put the number(s) in the list at the bottom.
--
--   * students.enrollment_no is cleared, so the Candidates tab shows the
--     Registration button again (now gated on the Registration Certificate's
--     Payment Condition).
--   * Any Registration Certificate number claim (letter_refs) is removed.
--   * A number from the Master Panel series (e.g. SIUPHDPE25001) also rewinds
--     the series' Next No., if nothing was issued after it.
--
-- Each number must belong to exactly one Ph.D candidate who has NOT been
-- forwarded to the Exam Section; otherwise nothing at all is changed.
-- Run in Supabase -> SQL Editor.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.take_back_reg_no(p_no text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE st record; n int; claimed int;
BEGIN
  SELECT count(*) INTO n FROM students WHERE enrollment_no = p_no;
  IF n <> 1 THEN RAISE EXCEPTION '% students hold % — expected exactly 1. Nothing changed.', n, p_no; END IF;

  SELECT s.id, s.student_name, s.session_id, s.exam_forwarded_at, p.program_name
  INTO st FROM students s LEFT JOIN programs p ON p.id = s.programme_id
  WHERE s.enrollment_no = p_no;
  IF st.program_name !~* 'ph\.?\s*d|doctor' THEN
    RAISE EXCEPTION '% (%) is not a Ph.D candidate (%). Nothing changed.', p_no, st.student_name, st.program_name;
  END IF;
  IF st.exam_forwarded_at IS NOT NULL THEN
    RAISE EXCEPTION '% (%) was already forwarded to the Exam Section. Nothing changed.', p_no, st.student_name;
  END IF;

  SELECT num INTO claimed FROM letter_refs
  WHERE letter_name = 'Enrollment Certificate' AND student_id = st.id;

  UPDATE students SET enrollment_no = NULL WHERE id = st.id;
  DELETE FROM letter_refs WHERE letter_name = 'Enrollment Certificate' AND student_id = st.id;

  IF claimed IS NOT NULL THEN
    UPDATE letter_settings SET next_num = claimed
    WHERE name = 'Enrollment Certificate'
      AND session_key IN (coalesce(st.session_id::text, ''), '')
      AND next_num = claimed + 1
      AND NOT EXISTS (SELECT 1 FROM letter_refs r
                      WHERE r.letter_name = 'Enrollment Certificate' AND r.num > claimed);
  END IF;

  RETURN p_no || ' taken back from ' || st.student_name;
END $$;

SELECT pg_temp.take_back_reg_no(x) AS result
FROM unnest(ARRAY[
  'EN25PHDFT0001'
]) AS x;

COMMIT;
