-- Per-course (program + session) exam settings: the Exam Schedule and the
-- Admit Card date/time. Printed on Admit Cards and used to gate admit-card
-- generation (cannot generate before admit_card_time) for that course.
-- Run in Supabase -> SQL Editor.

CREATE TABLE IF NOT EXISTS exam_schedules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  session_id      uuid REFERENCES academic_sessions(id) ON DELETE CASCADE,  -- null = all sessions
  exam_schedule   text,   -- datetime-local / ISO string
  admit_card_time text,   -- datetime-local / ISO string
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_schedules_program ON exam_schedules(program_id);

SELECT 'exam_schedules ready' AS result;
