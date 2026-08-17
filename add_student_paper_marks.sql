-- Marks a student obtained in each PAPER of a semester.
--
-- student_results already records a semester's outcome (pass/fail, an overall
-- obtained/total), but the Statement of Marks prints a line per paper —
-- theory and internal separately, with a grade and earned credit against the
-- scheme's maximums. That detail had nowhere to live.
--
-- Maximums and credits come from scheme_papers; this table holds only what the
-- student scored. Keyed by the same paper_key as the scheme, so a syllabus
-- edit (which deletes and re-inserts every paper row) cannot wipe the marks.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- (Run security_hardening.sql first — the policy below uses is_admin().)

CREATE TABLE IF NOT EXISTS student_paper_marks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  semester          int NOT NULL,
  paper_key         text NOT NULL,
  theory_obtained   numeric,
  internal_obtained numeric,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, semester, paper_key)
);

CREATE INDEX IF NOT EXISTS idx_paper_marks_student ON student_paper_marks(student_id);

ALTER TABLE student_paper_marks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'student_paper_marks' LOOP
    EXECUTE format('DROP POLICY %I ON student_paper_marks', p.policyname);
  END LOOP;
END $$;

-- The Exam Section enters them. Nobody else writes; a centre may read its own
-- students' marks, the same way it reads their released admit cards.
CREATE POLICY paper_marks_admin_all ON student_paper_marks
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY paper_marks_center_read ON student_paper_marks
  FOR SELECT TO authenticated USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN centers c ON c.id = s.center_id
      WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

SELECT 'student_paper_marks ready' AS result;
