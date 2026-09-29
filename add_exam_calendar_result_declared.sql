-- A separate Result Published Date on the Examination Calendar.
--
-- result_published used to do two jobs: it was printed on the marksheet as
-- the Date of Issue, and it was stamped on each result as the date the
-- result was declared. Those are two different dates — the day results are
-- announced, and the day the marksheets are printed — so they are split:
--
--   result_published    -> shown as "Marksheet Printing Date"; printed on
--                          the marksheet as its Date of Issue (unchanged)
--   result_declared_on  -> shown as "Result Published Date"; stamped on each
--                          result as its declared date when it is saved
--
-- Run once in Supabase -> SQL Editor. Safe to re-run. Until it is run the
-- calendar keeps saving everything else and skips only this date.

ALTER TABLE exam_calendar ADD COLUMN IF NOT EXISTS result_declared_on date;

SELECT 'exam_calendar.result_declared_on ready' AS result;
