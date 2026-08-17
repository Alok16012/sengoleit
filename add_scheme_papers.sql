-- Examination Scheme — the marks split for each paper of a course.
--
-- The Syllabus page says WHICH papers a course has; the Scheme page says what
-- each paper is worth: internal marks, external marks, total, passing marks
-- and credits. So a course only reaches the Scheme page once its syllabus is
-- done, and its papers are read straight from the syllabus rather than typed
-- again.
--
-- Why a separate table rather than columns on syllabus_subjects: saving the
-- syllabus DELETES every row for the course and re-inserts it, so a paper's id
-- changes on each edit. Marks stored against that id — or in a table keyed to
-- it — would be wiped every time somebody corrected a subject name. This table
-- is keyed by the paper's own identity instead (its subject code, or its paper
-- number + name when it has no code), so marks survive a syllabus edit.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- (Run security_hardening.sql first — the policy below uses is_admin().)

CREATE TABLE IF NOT EXISTS scheme_papers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id     uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  session_id     uuid REFERENCES academic_sessions(id) ON DELETE CASCADE,  -- null = all sessions
  semester       int,
  -- The paper's stable identity within the course: its subject code when it
  -- has one, else 'paper_no|subject_name'. Built by paperKeyOf() in the app.
  paper_key      text NOT NULL,
  -- Maximum marks: internal + theory make up the total.
  internal_marks numeric,
  theory_marks   numeric,
  total_marks    numeric,
  credits        numeric,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- An earlier draft of this file shipped external_marks / passing_marks. Bring
-- such a table into line rather than leaving two shapes in the wild.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'scheme_papers'
               AND column_name = 'external_marks') THEN
    ALTER TABLE scheme_papers RENAME COLUMN external_marks TO theory_marks;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'scheme_papers'
               AND column_name = 'passing_marks') THEN
    ALTER TABLE scheme_papers DROP COLUMN passing_marks;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scheme_papers_program ON scheme_papers(program_id);

-- One row per paper. Two indexes because NULL session_id (a course-wide
-- scheme) would otherwise slip past a plain UNIQUE, which treats NULLs as
-- distinct and would let duplicates in.
CREATE UNIQUE INDEX IF NOT EXISTS uq_scheme_paper_sess
  ON scheme_papers (program_id, session_id, semester, paper_key)
  WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_scheme_paper_all
  ON scheme_papers (program_id, semester, paper_key)
  WHERE session_id IS NULL;

ALTER TABLE scheme_papers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'scheme_papers' LOOP
    EXECUTE format('DROP POLICY %I ON scheme_papers', p.policyname);
  END LOOP;
END $$;

-- The university sets the scheme; centres and students only read it — the same
-- shape as the syllabus it hangs off.
CREATE POLICY scheme_papers_admin_all ON scheme_papers
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY scheme_papers_read ON scheme_papers
  FOR SELECT TO authenticated USING (true);

SELECT 'scheme_papers ready' AS result;
