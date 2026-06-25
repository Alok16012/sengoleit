-- Track when an approved/enrolled student is forwarded to the Exam Section.
-- The admit card is generated ONLY in the Exam Section, after this is set.
-- Run in Supabase -> SQL Editor.

ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_forwarded_at timestamptz;
