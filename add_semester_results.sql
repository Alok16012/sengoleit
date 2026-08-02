-- Semester-wise exam results.
--
-- A student sits one exam per semester, so a result belongs to a SEMESTER, not
-- to the student as a whole. The single exam_result_* columns on `students`
-- could only ever hold the latest one; they stay untouched so nothing breaks
-- while this is rolled out.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- (Run security_hardening.sql first — the policies below use is_admin().)

CREATE TABLE IF NOT EXISTS student_results (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  semester       int  NOT NULL,
  status         text NOT NULL DEFAULT 'Pending',   -- Pending | Pass | Fail
  obtained_marks text,
  total_marks    text,
  remarks        text,
  marksheet_url  text,
  declared_at    timestamptz,
  released_at    timestamptz,        -- set when sent to the student
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, semester)
);

CREATE INDEX IF NOT EXISTS idx_student_results_student ON student_results(student_id);

ALTER TABLE student_results ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'student_results' LOOP
    EXECUTE format('DROP POLICY %I ON student_results', p.policyname);
  END LOOP;
END $$;

-- The Exam Section (admin) enters and releases results.
CREATE POLICY student_results_admin_all ON student_results
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Centres see their own students' released results.
CREATE POLICY student_results_center_read ON student_results
  FOR SELECT TO authenticated USING (
    released_at IS NOT NULL
    AND student_id IN (
      SELECT s.id FROM students s
      JOIN centers c ON c.id = s.center_id
      WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

-- The student portal keeps its own session (not Supabase Auth), so it reads
-- through this function rather than the table — anon gets nothing directly.
CREATE OR REPLACE FUNCTION student_results_self(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE sid uuid; payload jsonb;
BEGIN
  SELECT ss.student_id INTO sid FROM student_sessions ss
  WHERE ss.token_hash = encode(digest(p_token, 'sha256'), 'hex') AND ss.expires_at > now()
  LIMIT 1;
  IF sid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r.*) ORDER BY r.semester), '[]'::jsonb) INTO payload
  FROM student_results r
  WHERE r.student_id = sid AND r.released_at IS NOT NULL AND r.status <> 'Pending';

  RETURN payload;
END $$;

GRANT EXECUTE ON FUNCTION student_results_self(text) TO anon, authenticated;

SELECT 'student_results ready' AS result;
