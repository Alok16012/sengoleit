-- Take back Registration No. SIUPHDPE25001, issued before the Registration
-- Certificate's Payment Condition (Rs 90,000) was paid.
--
--   * students.enrollment_no is cleared, so the Candidates tab shows the
--     Registration button again (now gated on the Rs 90,000).
--   * The Registration Certificate's number claim (letter_refs) is removed.
--   * The series' Next No. goes back to 25001, but only if nothing was issued
--     after it — so the same number is handed out again next time.
--
-- Stops, changing nothing, if no student or more than one student holds the
-- number, or if the student has already been forwarded to the Exam Section.
-- Run once in Supabase -> SQL Editor.

BEGIN;

DO $$
DECLARE
  st record; n int; claimed int; sess text;
BEGIN
  SELECT count(*) INTO n FROM students WHERE enrollment_no = 'SIUPHDPE25001';
  IF n <> 1 THEN RAISE EXCEPTION '% students hold SIUPHDPE25001 — expected exactly 1. Nothing changed.', n; END IF;

  SELECT id, student_name, session_id, exam_forwarded_at INTO st
  FROM students WHERE enrollment_no = 'SIUPHDPE25001';
  IF st.exam_forwarded_at IS NOT NULL THEN
    RAISE EXCEPTION '% was already forwarded to the Exam Section — not taking the number back. Nothing changed.', st.student_name;
  END IF;

  SELECT num INTO claimed FROM letter_refs
  WHERE letter_name = 'Enrollment Certificate' AND student_id = st.id;

  UPDATE students SET enrollment_no = NULL WHERE id = st.id;
  DELETE FROM letter_refs WHERE letter_name = 'Enrollment Certificate' AND student_id = st.id;

  -- Rewind the series only when this was the last number it handed out.
  IF claimed IS NOT NULL THEN
    sess := coalesce(st.session_id::text, '');
    UPDATE letter_settings SET next_num = claimed
    WHERE name = 'Enrollment Certificate'
      AND session_key IN (sess, '')
      AND next_num = claimed + 1
      AND NOT EXISTS (SELECT 1 FROM letter_refs r
                      WHERE r.letter_name = 'Enrollment Certificate' AND r.num > claimed);
  END IF;

  RAISE NOTICE 'Took back SIUPHDPE25001 from %', st.student_name;
END $$;

COMMIT;

-- Check afterwards: no student should hold the number, and Next No. should read 25001.
SELECT 'students holding SIUPHDPE25001' AS item, count(*)::text AS value
FROM students WHERE enrollment_no = 'SIUPHDPE25001'
UNION ALL
SELECT 'Registration Certificate Next No. (' || coalesce(nullif(session_key, ''), 'all sessions') || ')', next_num::text
FROM letter_settings WHERE name = 'Enrollment Certificate';
