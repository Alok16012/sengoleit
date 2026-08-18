-- The student's own Statement of Marks, read through one function.
--
-- The student portal has no Supabase Auth session — it holds its own token and
-- reads through SECURITY DEFINER functions (student_results_self,
-- student_admit_cards_self). Its marksheet, though, read scheme_papers,
-- student_paper_marks and exam_calendar directly, and all three are open only
-- TO authenticated. The syllabus is not, so the student's sheet came out with
-- the subject names filled in and every other column a dash: no maximums, no
-- credits, no marks, no examination dates.
--
-- This returns the same rows the Exam Section assembles, for one student and
-- one semester, plus what a CGPA needs from the semesters before it.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

CREATE OR REPLACE FUNCTION student_marksheet_self(p_token text, p_semester int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  sid uuid; pid uuid; sess uuid;
  papers jsonb; upto jsonb; cal record;
BEGIN
  SELECT ss.student_id INTO sid FROM student_sessions ss
  WHERE ss.token_hash = encode(digest(p_token, 'sha256'), 'hex') AND ss.expires_at > now()
  LIMIT 1;
  IF sid IS NULL THEN RETURN '{}'::jsonb; END IF;

  -- A result the student cannot see yet has no marksheet either.
  IF NOT EXISTS (
    SELECT 1 FROM student_results r
    WHERE r.student_id = sid AND r.semester = p_semester
      AND r.released_at IS NOT NULL AND r.status <> 'Pending'
  ) THEN RETURN '{}'::jsonb; END IF;

  SELECT s.programme_id, s.session_id INTO pid, sess FROM students s WHERE s.id = sid;

  -- One semester's papers: the syllabus, the scheme's maximums, and what the
  -- student scored — narrowed to the papers their admit card carried, since a
  -- semester offers alternatives and only one of each is sat.
  WITH sub AS (
    SELECT ss.id,
           coalesce(nullif(trim(coalesce(ss.subject_code, '')), ''), trim(coalesce(ss.paper_no, '')))
             || '|' || trim(coalesce(ss.subject_name, '')) AS paper_key,
           ss.subject_code, ss.subject_name, ss.sort_order
    FROM syllabus_subjects ss
    WHERE ss.program_id = pid AND ss.session_id IS NULL AND ss.semester = p_semester
  ),
  card AS (
    SELECT ac.subject_ids, ac.subject_keys FROM student_admit_cards ac
    WHERE ac.student_id = sid AND ac.semester = p_semester LIMIT 1
  ),
  kept AS (
    SELECT sub.* FROM sub
    WHERE NOT EXISTS (SELECT 1 FROM card)
       OR (SELECT coalesce(array_length(c.subject_keys, 1), 0) FROM card c) > 0
          AND sub.paper_key = ANY ((SELECT c.subject_keys FROM card c))
       OR (SELECT coalesce(array_length(c.subject_keys, 1), 0) FROM card c) = 0
          AND sub.id = ANY ((SELECT c.subject_ids FROM card c))
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'paper_key', k.paper_key,
           'subject_code', k.subject_code,
           'subject_name', k.subject_name,
           'credits', sp.credits,
           'internal_marks', sp.internal_marks,
           'theory_marks', sp.theory_marks,
           'total_marks', sp.total_marks,
           'theory_obtained', pm.theory_obtained,
           'internal_obtained', pm.internal_obtained
         ) ORDER BY k.sort_order), '[]'::jsonb) INTO papers
  FROM kept k
  LEFT JOIN scheme_papers sp
    ON sp.program_id = pid AND sp.session_id IS NULL
   AND sp.semester = p_semester AND sp.paper_key = k.paper_key
  LEFT JOIN student_paper_marks pm
    ON pm.student_id = sid AND pm.semester = p_semester AND pm.paper_key = k.paper_key;

  -- Everything up to this semester, for the CGPA. Only what the average needs.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'credits', sp.credits,
           'total_marks', sp.total_marks,
           'theory_obtained', pm.theory_obtained,
           'internal_obtained', pm.internal_obtained
         )), '[]'::jsonb) INTO upto
  FROM student_paper_marks pm
  JOIN scheme_papers sp
    ON sp.program_id = pid AND sp.session_id IS NULL
   AND sp.semester = pm.semester AND sp.paper_key = pm.paper_key
  WHERE pm.student_id = sid AND pm.semester <= p_semester;

  -- The examination session and the publication date for this semester.
  SELECT ec.exam_held, ec.result_published, ec.start_date INTO cal
  FROM exam_calendar ec
  WHERE ec.session_id = sess AND ec.semester IN (p_semester, 100 + p_semester)
  ORDER BY (ec.semester = p_semester) DESC LIMIT 1;

  RETURN jsonb_build_object(
    'papers', papers,
    'upto', upto,
    'exam_held', cal.exam_held,
    'exam_start', cal.start_date,
    'result_published', cal.result_published
  );
END $$;

GRANT EXECUTE ON FUNCTION student_marksheet_self(text, int) TO anon, authenticated;

SELECT 'student_marksheet_self ready' AS result;
