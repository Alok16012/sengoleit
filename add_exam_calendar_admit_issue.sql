-- Examination Calendar: Admit Card Issue Date, per session and semester.
-- Printed on the admit card as its issue date, so every card of a semester
-- carries the same date.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

ALTER TABLE exam_calendar ADD COLUMN IF NOT EXISTS admit_card_issued_on date;

-- The student portal reads its calendar through this function; it now
-- carries the new date too.
CREATE OR REPLACE FUNCTION student_exam_calendar_self(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  sid uuid; sess uuid; payload jsonb;
BEGIN
  SELECT ss.student_id INTO sid FROM student_sessions ss
  WHERE ss.token_hash = encode(digest(p_token, 'sha256'), 'hex') AND ss.expires_at > now()
  LIMIT 1;
  IF sid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT s.session_id INTO sess FROM students s WHERE s.id = sid;
  IF sess IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'semester',             ec.semester,
           'start_date',           ec.start_date,
           'end_date',             ec.end_date,
           'exam_held',            ec.exam_held,
           'result_published',     ec.result_published,
           'admit_card_issued_on', ec.admit_card_issued_on
         ) ORDER BY ec.semester), '[]'::jsonb) INTO payload
  FROM exam_calendar ec
  WHERE ec.session_id = sess;

  RETURN payload;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'admit card issue date ready' AS result;
