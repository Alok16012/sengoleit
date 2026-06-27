-- Student height (free text, e.g. 5'7" or 170 cm). Shown in Personal Info.
-- Run in Supabase -> SQL Editor.

ALTER TABLE students ADD COLUMN IF NOT EXISTS height text;

SELECT 'students.height ready' AS result;
