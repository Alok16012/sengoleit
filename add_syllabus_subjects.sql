-- Syllabus: subjects/papers per course (program + session), used to populate
-- the "Papers to be appeared" section of the Admit Card.
-- Run in Supabase -> SQL Editor.

CREATE TABLE IF NOT EXISTS syllabus_subjects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  session_id   uuid REFERENCES academic_sessions(id) ON DELETE CASCADE,  -- null = all sessions
  semester     integer,        -- the "Sem" dropdown value
  paper_no     text,
  subject_code text,
  subject_name text,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_syllabus_program ON syllabus_subjects(program_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_session ON syllabus_subjects(session_id);

SELECT 'syllabus_subjects ready' AS result;
