-- Paper keys — add the subject NAME, because a subject code is not unique.
--
-- scheme_papers and student_paper_marks identify a paper by `paper_key`, which
-- was the subject code alone. B.Ed's Semester 2 carries three papers coded
-- BED202 — Teaching of English, of Kannada and of Hindi, alternatives a
-- student picks one of — so all three shared one identity and saving that
-- semester's scheme failed on uq_scheme_paper_all.
--
-- The app now builds the key as '<code or paper no>|<subject name>'. This
-- brings already-saved rows to the same shape so their marks are not orphaned.
--
-- Only keys WITHOUT a '|' are touched: a paper that never had a code was
-- already stored as 'paper_no|name' and is unchanged. A key matching more than
-- one syllabus row is left alone and reported at the end — that is the
-- ambiguous case, which could never have saved in the first place.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

-- 1) The course-level scheme.
UPDATE scheme_papers sp
SET paper_key = sp.paper_key || '|' || trim(coalesce(ss.subject_name, ''))
FROM syllabus_subjects ss
WHERE ss.program_id = sp.program_id
  AND ss.session_id IS NULL
  AND ss.semester = sp.semester
  AND trim(coalesce(ss.subject_code, '')) = sp.paper_key
  AND position('|' in sp.paper_key) = 0
  AND (
    SELECT count(*) FROM syllabus_subjects x
    WHERE x.program_id = sp.program_id AND x.session_id IS NULL
      AND x.semester = sp.semester
      AND trim(coalesce(x.subject_code, '')) = sp.paper_key
  ) = 1;

-- 2) Students' own marks, whose course comes from the student row.
UPDATE student_paper_marks pm
SET paper_key = pm.paper_key || '|' || trim(coalesce(ss.subject_name, ''))
FROM students st, syllabus_subjects ss
WHERE st.id = pm.student_id
  AND ss.program_id = st.programme_id
  AND ss.session_id IS NULL
  AND ss.semester = pm.semester
  AND trim(coalesce(ss.subject_code, '')) = pm.paper_key
  AND position('|' in pm.paper_key) = 0
  AND (
    SELECT count(*) FROM syllabus_subjects x
    WHERE x.program_id = st.programme_id AND x.session_id IS NULL
      AND x.semester = pm.semester
      AND trim(coalesce(x.subject_code, '')) = pm.paper_key
  ) = 1;

-- 3) Anything still in the old shape. An empty result means every saved mark
--    carried over; a row here is a key whose code matches no syllabus paper
--    (or matches several), and its marks need re-entering for that paper.
SELECT 'scheme_papers' AS table_name, sp.program_id::text AS owner, sp.semester, sp.paper_key
FROM scheme_papers sp WHERE position('|' in sp.paper_key) = 0
UNION ALL
SELECT 'student_paper_marks', pm.student_id::text, pm.semester, pm.paper_key
FROM student_paper_marks pm WHERE position('|' in pm.paper_key) = 0
ORDER BY 1, 3, 4;
