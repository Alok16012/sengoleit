-- Course-level full-syllabus PDF: one PDF per course (program + session),
-- uploaded from the Syllabus list "Upload PDF" action.
-- Run in Supabase -> SQL Editor.

CREATE TABLE IF NOT EXISTS course_syllabus_pdfs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  session_id  uuid REFERENCES academic_sessions(id) ON DELETE CASCADE,  -- null = all sessions
  pdf_url     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_pdf_program ON course_syllabus_pdfs(program_id);

SELECT 'course_syllabus_pdfs ready' AS result;
