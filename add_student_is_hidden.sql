-- Adds a soft-hide flag to students so the admin can hide a student row from
-- the default Students list (and unhide it later) without deleting anything.
--
-- Hidden students are excluded from the admin Students list unless "Show Hidden"
-- is toggled on. This does NOT affect center/department views.
--
-- Run once in Supabase -> SQL Editor.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

SELECT 'students.is_hidden ready' AS result;
