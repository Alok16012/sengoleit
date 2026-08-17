-- Registration numbers — re-stamp the year from the student's SESSION.
--
-- SIU<yy>R used to take <yy> from whenever the Account Dept happened to
-- approve the student, so a July 2025 student approved in 2026 was numbered
-- SIU26R1052 while their own enrollment number read EN25PGDCA0001 — the two
-- numbers disagreed about which session the student belongs to. The generator
-- now reads the session; this brings already-issued numbers into line.
--
-- IMPORTANT: a registration number is printed on the Registration Certificate
-- and the Admit Card. Re-print those for every student this changes.
--
-- Only the year changes; the serial is kept, so SIU26R1052 becomes SIU25R1052
-- and a student keeps their place in the sequence. A student whose target
-- number is already held by someone else is left untouched and reported by the
-- last query rather than being silently renumbered into a clash.
--
-- Run in Supabase -> SQL Editor. Safe to re-run: a second run finds nothing.

-- 1) What is about to change — read this first.
SELECT s.student_name,
       a.session_name,
       s.registration_no AS current_no,
       'SIU' || right(substring(a.session_name from '(\d{4})'), 2) || 'R'
              || substring(s.registration_no from 'R(\d+)$') AS new_no
FROM students s
JOIN academic_sessions a ON a.id = s.session_id
WHERE s.registration_no ~ '^SIU\d{2}R\d+$'
  AND a.session_name ~ '\d{4}'
  AND s.registration_no <> 'SIU' || right(substring(a.session_name from '(\d{4})'), 2) || 'R'
                                 || substring(s.registration_no from 'R(\d+)$')
ORDER BY s.registration_no;

-- 2) Apply it.
UPDATE students s
SET registration_no = t.new_no
FROM (
  SELECT s2.id,
         'SIU' || right(substring(a.session_name from '(\d{4})'), 2) || 'R'
                || substring(s2.registration_no from 'R(\d+)$') AS new_no
  FROM students s2
  JOIN academic_sessions a ON a.id = s2.session_id
  WHERE s2.registration_no ~ '^SIU\d{2}R\d+$'
    AND a.session_name ~ '\d{4}'
) t
WHERE s.id = t.id
  AND s.registration_no IS DISTINCT FROM t.new_no
  -- Never renumber into a number somebody else already holds.
  AND NOT EXISTS (
    SELECT 1 FROM students x WHERE x.registration_no = t.new_no AND x.id <> s.id
  );

-- 3) Anything still out of step — these were skipped because the target number
--    is already taken, and need deciding by hand. An empty result means done.
SELECT s.student_name,
       a.session_name,
       s.registration_no AS current_no,
       'SIU' || right(substring(a.session_name from '(\d{4})'), 2) || 'R'
              || substring(s.registration_no from 'R(\d+)$') AS wanted_no
FROM students s
JOIN academic_sessions a ON a.id = s.session_id
WHERE s.registration_no ~ '^SIU\d{2}R\d+$'
  AND a.session_name ~ '\d{4}'
  AND s.registration_no <> 'SIU' || right(substring(a.session_name from '(\d{4})'), 2) || 'R'
                                 || substring(s.registration_no from 'R(\d+)$')
ORDER BY s.registration_no;
