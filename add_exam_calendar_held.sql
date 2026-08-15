-- Examination Calendar — "Exam. Held" label per semester.
--
-- The admit card prints an examination session ("January 2026"). Deriving it
-- from the exam start date works only when dates are entered, and the Exam
-- Section wanted to write the month/year out explicitly instead. This label,
-- when filled in, is what the card prints; the start date's month and the
-- six-months-per-semester shift remain the fallbacks.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

ALTER TABLE exam_calendar ADD COLUMN IF NOT EXISTS exam_held text;

SELECT 'exam_calendar.exam_held ready' AS result;
