-- The centre reads admit cards, results and marksheets through functions,
-- as the admin and the student already do.
--
-- Why: three roles read the same three tables by three different routes.
--   admin   → is_admin(), which every policy allows outright.
--   student → student_admit_cards_self / student_results_self /
--             student_marksheet_self, SECURITY DEFINER, so RLS never applies.
--   centre  → the *_center_read policies, and nothing else.
--
-- So the centre is the only role whose reads depend on those policies holding
-- up, and it is the only role where the admit card list and the Result button
-- came back empty. A super centre could not see a SUB-centre's student at all:
-- every one of those policies matches `c.email = auth.jwt()->>'email'` against
-- the student's OWN centre, which a super centre's email never is.
--
-- These functions replace that route. They answer for the admin (everything)
-- and for a centre or super centre (its own students, and only what has been
-- released — the same rows the student portal returns, so a centre and a
-- student never disagree about a result).
--
-- The RLS policies are re-created at the bottom unchanged: a database where
-- they were never applied gets them, and the direct-table fallbacks in the app
-- keep working either way.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- (Run security_hardening.sql first — these use is_admin().)

-- ------------------------------------------------------------
-- Which centres the caller speaks for: its own, plus every sub-centre when
-- the caller is a super centre. Returns an empty array for anyone else, so a
-- caller who is neither admin nor centre matches no student at all.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal_center_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT t.id), '{}'::uuid[])
  FROM (
    SELECT c.id FROM centers c
     WHERE c.email = (auth.jwt() ->> 'email')
    UNION
    SELECT child.id FROM centers child
      JOIN centers parent ON parent.id = child.super_center_id
     WHERE parent.email = (auth.jwt() ->> 'email')
  ) t
$$;

GRANT EXECUTE ON FUNCTION portal_center_ids() TO authenticated;

-- ------------------------------------------------------------
-- Issued admit cards for a set of students.
-- Admin sees every card, released or not — it is the Exam Section that
-- decides which are visible, and it has to see the hidden ones to unhide
-- them. A centre sees only released cards, exactly as the student does.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal_admit_cards(p_students uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ids uuid[]; payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF p_students IS NULL OR coalesce(array_length(p_students, 1), 0) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  IF is_admin() THEN
    SELECT coalesce(jsonb_agg(to_jsonb(a.*) ORDER BY a.student_id, a.semester), '[]'::jsonb)
      INTO payload
    FROM student_admit_cards a
    WHERE a.student_id = ANY (p_students);
    RETURN payload;
  END IF;

  ids := portal_center_ids();
  IF coalesce(array_length(ids, 1), 0) = 0 THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(a.*) ORDER BY a.student_id, a.semester), '[]'::jsonb)
    INTO payload
  FROM student_admit_cards a
  JOIN students s ON s.id = a.student_id
  WHERE a.student_id = ANY (p_students)
    AND s.center_id = ANY (ids)
    AND a.released_at IS NOT NULL;
  RETURN payload;
END $$;

GRANT EXECUTE ON FUNCTION portal_admit_cards(uuid[]) TO authenticated;

-- ------------------------------------------------------------
-- Declared results for a set of students. Same split: the admin sees every
-- row including the ones still being entered, a centre sees the released,
-- non-Pending ones the student sees.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal_results(p_students uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ids uuid[]; payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF p_students IS NULL OR coalesce(array_length(p_students, 1), 0) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  IF is_admin() THEN
    SELECT coalesce(jsonb_agg(to_jsonb(r.*) ORDER BY r.student_id, r.semester), '[]'::jsonb)
      INTO payload
    FROM student_results r
    WHERE r.student_id = ANY (p_students);
    RETURN payload;
  END IF;

  ids := portal_center_ids();
  IF coalesce(array_length(ids, 1), 0) = 0 THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r.*) ORDER BY r.student_id, r.semester), '[]'::jsonb)
    INTO payload
  FROM student_results r
  JOIN students s ON s.id = r.student_id
  WHERE r.student_id = ANY (p_students)
    AND s.center_id = ANY (ids)
    AND r.released_at IS NOT NULL
    AND r.status <> 'Pending';
  RETURN payload;
END $$;

GRANT EXECUTE ON FUNCTION portal_results(uuid[]) TO authenticated;

-- ------------------------------------------------------------
-- One student's marksheet for one semester — the same jsonb shape
-- student_marksheet_self returns, so the centre's sheet and the student's
-- are assembled by the same rules and cannot drift apart.
--
-- The body below is student_marksheet_self's, with the token lookup replaced
-- by the centre/admin check. The comments there explain the admit-card
-- fallbacks; they apply here unchanged.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal_marksheet(p_student uuid, p_semester int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  ids uuid[]; admin boolean; pid uuid; sess uuid;
  has_card boolean; keys text[]; card_ids uuid[]; n_key int;
  papers jsonb; upto jsonb;
  c_held text; c_published date; c_start date;
BEGIN
  IF auth.uid() IS NULL OR p_student IS NULL OR p_semester IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  admin := is_admin();
  IF NOT admin THEN
    ids := portal_center_ids();
    IF coalesce(array_length(ids, 1), 0) = 0 THEN RETURN '{}'::jsonb; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = p_student AND s.center_id = ANY (ids)
    ) THEN RETURN '{}'::jsonb; END IF;

    -- A result the STUDENT cannot see, the centre cannot see either.
    IF NOT EXISTS (
      SELECT 1 FROM student_results r
      WHERE r.student_id = p_student AND r.semester = p_semester
        AND r.released_at IS NOT NULL AND r.status <> 'Pending'
    ) THEN RETURN '{}'::jsonb; END IF;
  END IF;

  SELECT s.programme_id, s.session_id INTO pid, sess
  FROM students s WHERE s.id = p_student;
  IF pid IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT true, ac.subject_keys, ac.subject_ids INTO has_card, keys, card_ids
  FROM student_admit_cards ac
  WHERE ac.student_id = p_student AND ac.semester = p_semester
  LIMIT 1;
  has_card := coalesce(has_card, false);
  keys     := coalesce(keys, '{}'::text[]);
  card_ids := coalesce(card_ids, '{}'::uuid[]);

  IF has_card AND coalesce(array_length(keys, 1), 0) > 0 THEN
    SELECT count(*) INTO n_key
    FROM syllabus_subjects ss
    WHERE ss.program_id = pid AND ss.session_id IS NULL AND ss.semester = p_semester
      AND (coalesce(nullif(trim(coalesce(ss.subject_code, '')), ''), trim(coalesce(ss.paper_no, '')))
           || '|' || trim(coalesce(ss.subject_name, ''))) = ANY (keys);
    IF n_key = 0 THEN keys := '{}'::text[]; END IF;
  END IF;

  IF has_card AND coalesce(array_length(keys, 1), 0) = 0
                AND coalesce(array_length(card_ids, 1), 0) = 0 THEN
    has_card := false;
  END IF;

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
       OR (coalesce(array_length(keys, 1), 0) = 0 AND sub.id = ANY (card_ids))
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
    ON pm.student_id = p_student AND pm.semester = p_semester AND pm.paper_key = k.paper_key;

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
  WHERE pm.student_id = p_student AND pm.semester <= p_semester;

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

GRANT EXECUTE ON FUNCTION portal_marksheet(uuid, int) TO authenticated;

-- ------------------------------------------------------------
-- Re-create the centre RLS policies, unchanged, so a database that never got
-- them has them. The app now reads through the functions above and only falls
-- back to the tables directly, but the fallback should work where it can.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS admit_cards_center_read ON student_admit_cards;
CREATE POLICY admit_cards_center_read ON student_admit_cards
  FOR SELECT TO authenticated USING (
    released_at IS NOT NULL
    AND student_id IN (
      SELECT s.id FROM students s WHERE s.center_id = ANY (portal_center_ids())
    )
  );

DROP POLICY IF EXISTS student_results_center_read ON student_results;
CREATE POLICY student_results_center_read ON student_results
  FOR SELECT TO authenticated USING (
    released_at IS NOT NULL
    AND student_id IN (
      SELECT s.id FROM students s WHERE s.center_id = ANY (portal_center_ids())
    )
  );

DROP POLICY IF EXISTS paper_marks_center_read ON student_paper_marks;
CREATE POLICY paper_marks_center_read ON student_paper_marks
  FOR SELECT TO authenticated USING (
    student_id IN (
      SELECT s.id FROM students s WHERE s.center_id = ANY (portal_center_ids())
    )
  );

SELECT 'center portal reads ready' AS result;
