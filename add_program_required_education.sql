-- Minimum required prior education level per program, enforced during student
-- admission (Education step). Ladder: 1=10th, 2=12th, 3=UG, 4=PG, 5=MPhil.
-- null = no requirement.
-- Run in Supabase -> SQL Editor.

ALTER TABLE programs ADD COLUMN IF NOT EXISTS required_education_level smallint;

SELECT 'programs.required_education_level ready' AS result;
