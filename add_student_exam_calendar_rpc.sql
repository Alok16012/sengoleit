-- The examination calendar, read by the student's own portal.
--
-- exam_calendar is open only TO authenticated. The student portal holds its own
-- token instead of a Supabase Auth session, so reading the table directly came
-- back empty — with no error. fetchExamDates took that to mean "this session
-- has no calendar" and the admit card fell back to GUESSING the examination
-- session: the admission batch shifted six months per completed semester.
--
-- So a July 2025 student's Semester 1 card printed "July 2025" (the admission
-- batch, not an examination session at all) and Semester 2 printed "January
-- 2026" — right only by coincidence. The centre and admin portals, which are
-- authenticated, printed the calendar's real "Exam. Held" label all along.
--
-- Returns every calendar row for the student's session; the caller picks the
-- term. Ph.D years keep their 100+ offset, as stored.
--
-- Run in Supabase -> SQL Editor. Safe to re-run.

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
           'semester',         ec.semester,
           'start_date',       ec.start_date,
           'end_date',         ec.end_date,
           'exam_held',        ec.exam_held,
           'result_published', ec.result_published
         ) ORDER BY ec.semester), '[]'::jsonb) INTO payload
  FROM exam_calendar ec
  WHERE ec.session_id = sess;

  RETURN payload;
END $$;

GRANT EXECUTE ON FUNCTION student_exam_calendar_self(text) TO anon, authenticated;

SELECT 'student_exam_calendar_self ready' AS result;
