-- When a result's marksheet was printed.
--
-- The Exam Section's Print tab lists every result forwarded for printing,
-- but nothing recorded which marksheets had actually been printed, so the
-- office had no way to see what was still to do. printed_at is stamped the
-- first time the Statement of Grades is sent to the printer (its Download
-- PDF button), and the Print tab splits into Pending and Done on it.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

ALTER TABLE student_results ADD COLUMN IF NOT EXISTS printed_at timestamptz;

SELECT 'student_results.printed_at ready' AS result;
