-- Exam Section: admit card release + exam result columns.
-- Run in Supabase -> SQL Editor.

-- Admit card release to the student portal (separate from exam_forwarded_at).
ALTER TABLE students ADD COLUMN IF NOT EXISTS admit_card_released_at timestamptz;

-- Exam result fields shown/edited in the Exam Section Result modal.
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_status text;          -- Pending / Pass / Fail
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_obtained_marks numeric;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_total_marks numeric;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_marksheet_url text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_declared_at timestamptz;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_remarks text;
