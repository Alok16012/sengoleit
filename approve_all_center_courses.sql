-- Course allotment no longer has an approval step: allotting a course to a
-- center makes it active immediately (Center Courses → "Add Course" inserts
-- status = 'approved').
--
-- That leaves the rows allotted under the old two-step flow sitting at
-- 'pending' — invisible to the center portal, to student admission and to
-- Syllabus, all of which gate on status = 'approved'. Activate them so the
-- courses those centers were already given actually work.
--
-- 'approved' stays the DEFAULT-less explicit value written by the app; the
-- column default is left as 'pending' only so an old client cannot silently
-- activate a course.
--
-- Run once in Supabase → SQL Editor, BEFORE deploying.

-- How many rows are about to change (run first if you want to eyeball it):
SELECT count(*) AS pending_rows_to_activate
FROM center_courses
WHERE status = 'pending';

UPDATE center_courses
SET    status      = 'approved',
       approved_at = COALESCE(approved_at, now())
WHERE  status = 'pending';

-- Should be 0 afterwards.
SELECT status, count(*) AS rows
FROM center_courses
GROUP BY status
ORDER BY status;
