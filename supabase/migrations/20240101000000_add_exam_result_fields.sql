-- Migration to add Admit Card release and Exam Result fields to the students table.
-- Run this in Supabase -> SQL Editor.

ALTER TABLE students ADD COLUMN IF NOT EXISTS admit_card_released_at timestamptz;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_status text CHECK (exam_result_status IN ('Pending', 'Pass', 'Fail')) DEFAULT 'Pending';
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_obtained_marks text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_total_marks text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_marksheet_url text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_declared_at timestamptz;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_remarks text;

SELECT 'Exam result and admit card release fields added successfully.' AS result;
