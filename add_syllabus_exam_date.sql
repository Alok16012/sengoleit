-- Per-subject exam date (the date sheet). One fixed date per syllabus subject.
-- Run in Supabase -> SQL Editor.

ALTER TABLE syllabus_subjects ADD COLUMN IF NOT EXISTS exam_date text;

SELECT 'syllabus_subjects.exam_date ready' AS result;
