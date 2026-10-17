-- Courier Details: the students a courier carried, each with the semesters
-- whose documents went in it — [{ id, name, enrollment_no, program, semesters: [1,2] }].
-- student_name stays as a plain-text copy of the names (and holds entries
-- made before this column existed).
--
-- Run once in Supabase -> SQL Editor, after add_courier_details.sql. Safe to re-run.

ALTER TABLE courier_details ADD COLUMN IF NOT EXISTS students jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Make the API see the new column straight away (otherwise saving says
-- "Could not find the 'students' column ... in the schema cache").
NOTIFY pgrst, 'reload schema';

SELECT column_name FROM information_schema.columns
 WHERE table_name = 'courier_details' AND column_name = 'students';
