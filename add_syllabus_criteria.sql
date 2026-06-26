-- Adds the "Criteria" column to syllabus subjects/papers
-- (shown as a column in the Syllabus editor next to Subject Name).
-- Run in Supabase -> SQL Editor.

ALTER TABLE syllabus_subjects ADD COLUMN IF NOT EXISTS criteria text;

SELECT 'syllabus_subjects.criteria ready' AS result;
