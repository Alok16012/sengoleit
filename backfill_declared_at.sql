-- Result declaration dates — take them from the Examination Calendar.
--
-- declared_at was stamped with whatever moment the admin pressed Save, so a
-- correction re-dated the result and the student portal showed today's date
-- rather than the day the university published it. Saving now reads the
-- semester's Result Published Date; this brings existing results into line.
--
-- Midday UTC, not midnight: stored at midnight the same instant reads as the
-- previous day anywhere west of UTC.
--
-- Run in Supabase -> SQL Editor. Safe to re-run.

UPDATE student_results r
SET declared_at = (ec.result_published + time '12:00') AT TIME ZONE 'UTC'
FROM students s, exam_calendar ec
WHERE s.id = r.student_id
  AND ec.session_id = s.session_id
  AND ec.semester IN (r.semester, 100 + r.semester)
  AND ec.result_published IS NOT NULL
  AND r.declared_at IS DISTINCT FROM ((ec.result_published + time '12:00') AT TIME ZONE 'UTC');

-- Results whose semester has no published date set — these keep the day they
-- were saved. Set the date in the Examination Calendar and re-run to fix them.
SELECT s.student_name, r.semester, r.declared_at::date AS declared_on
FROM student_results r
JOIN students s ON s.id = r.student_id
LEFT JOIN exam_calendar ec
  ON ec.session_id = s.session_id
 AND ec.semester IN (r.semester, 100 + r.semester)
 AND ec.result_published IS NOT NULL
WHERE ec.id IS NULL
ORDER BY s.student_name, r.semester;
