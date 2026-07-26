-- Enable the separate Ph.D examination calendar.
--
-- Ph.D years are stored in the SAME exam_calendar table at a 100+ offset
-- (101-106 = Year 1-6) so they stay independent of regular semesters (1-10)
-- without colliding on the UNIQUE(session_id, semester) key. The original
-- CHECK only allowed 1-12, which rejected the Ph.D rows — widen it.
--
-- Run this once in Supabase -> SQL Editor.

ALTER TABLE exam_calendar DROP CONSTRAINT IF EXISTS exam_calendar_semester_check;
ALTER TABLE exam_calendar ADD CONSTRAINT exam_calendar_semester_check
  CHECK (semester BETWEEN 1 AND 112);

SELECT 'exam_calendar semester check widened to 1-112 (Ph.D ready)' AS result;
