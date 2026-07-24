-- Ph.D specialization on the student record.
--
-- The admission form shows a "Specialization" field only for PhD (Doctorate)
-- programmes and saves it here. Nothing else uses it.
--
-- Run this once in Supabase -> SQL Editor.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS specialization text;

SELECT 'students.specialization ready' AS result;
