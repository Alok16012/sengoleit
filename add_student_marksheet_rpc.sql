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
-- RE-RUN THIS. The first version raised "operator does not exist: text = text[]"
-- on every call (see the note on the admit-card lookup below), so no student
-- could open a marksheet at all.
--
-- Run in Supabase -> SQL Editor. Safe to re-run.

CREATE OR REPLACE FUNCTION student_marksheet_self(p_token text, p_semester int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  sid uuid; pid uuid; sess uuid;
  has_card boolean; keys text[]; ids uuid[];
  papers jsonb; upto jsonb;
  c_held text; c_published date; c_start date;
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

  -- The papers the student's admit card carried, read into variables first.
  -- Written inline as `= ANY ((SELECT subject_keys FROM card))`, Postgres reads
  -- the parenthesised SELECT as a SUBQUERY rather than as an array: it then
  -- compares text to text[] and raises "operator does not exist: text = text[]".
  -- That threw on every call, and the portal turned the error into "this
  -- marksheet is not available yet" — so no student could open one. A plain
  -- array variable is unambiguous.
  SELECT true, ac.subject_keys, ac.subject_ids INTO has_card, keys, ids
  FROM student_admit_cards ac
  WHERE ac.student_id = sid AND ac.semester = p_semester
  LIMIT 1;
  has_card := coalesce(has_card, false);
  keys := coalesce(keys, '{}'::text[]);
  ids  := coalesce(ids,  '{}'::uuid[]);

  -- One semester's papers: the syllabus, the scheme's maximums, and what the
  -- student scored — narrowed to the papers their admit card carried, since a
  -- semester offers alternatives and only one of each is sat. No card at all
  -- (a result declared before cards were issued per semester) keeps them all.
  WITH sub AS (
    SELECT ss.id,
           coalesce(nullif(trim(coalesce(ss.subject_code, '')), ''), trim(coalesce(ss.paper_no, '')))
             || '|' || trim(coalesce(ss.subject_name, '')) AS paper_key,
           ss.subject_code, ss.subject_name, ss.sort_order
    FROM syllabus_subjects ss
    WHERE ss.program_id = pid AND ss.session_id IS NULL AND ss.semester = p_semester
  ),
  kept AS (
    SELECT sub.* FROM sub
    WHERE NOT has_card
       OR (coalesce(array_length(keys, 1), 0) > 0 AND sub.paper_key = ANY (keys))
       OR (coalesce(array_length(keys, 1), 0) = 0 AND sub.id = ANY (ids))
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

  -- The examination session and the publication date for this semester. Read
  -- into plain variables rather than a record: a record left unassigned by a
  -- semester the calendar has no row for is a second way to throw here.
  SELECT ec.exam_held, ec.result_published, ec.start_date
    INTO c_held, c_published, c_start
  FROM exam_calendar ec
  WHERE ec.session_id = sess AND ec.semester IN (p_semester, 100 + p_semester)
  ORDER BY (ec.semester = p_semester) DESC LIMIT 1;

  RETURN jsonb_build_object(
    'papers', papers,
    'upto', upto,
    'exam_held', c_held,
    'exam_start', c_start,
    'result_published', c_published
  );
END $$;

GRANT EXECUTE ON FUNCTION student_marksheet_self(text, int) TO anon, authenticated;

SELECT 'student_marksheet_self ready' AS result;
