-- Additional education levels on students: MPhil and Others.
-- Run in Supabase -> SQL Editor.

ALTER TABLE students ADD COLUMN IF NOT EXISTS mphil_institute_name  TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mphil_board_university TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mphil_passing_year     TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mphil_obtained_marks   TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mphil_total_marks      TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mphil_marksheet_url    TEXT;

ALTER TABLE students ADD COLUMN IF NOT EXISTS others_institute_name  TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS others_board_university TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS others_passing_year     TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS others_obtained_marks   TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS others_total_marks      TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS others_marksheet_url    TEXT;

SELECT 'students MPhil/Others education columns ready' AS result;
