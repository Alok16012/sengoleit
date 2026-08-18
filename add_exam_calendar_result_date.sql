-- Examination Calendar — the date a semester's result is published.
--
-- The Statement of Marks prints "Date of Issue", which was simply the day the
-- sheet was printed — so the same student's marksheet carried a different date
-- every time it was reprinted. The result publication date belongs to the
-- semester, beside its examination dates, and every marksheet for that
-- semester should read the same one.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

ALTER TABLE exam_calendar ADD COLUMN IF NOT EXISTS result_published date;

SELECT 'exam_calendar.result_published ready' AS result;
