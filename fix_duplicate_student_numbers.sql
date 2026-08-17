-- Duplicate student numbers — give the later student a fresh one, then make
-- the database refuse to let it happen again.
--
-- Application numbers were built as "count the existing ones, add one" with no
-- check that the result was free, so two submissions racing each other (or a
-- deleted student dropping the count back onto a live number) handed out a
-- number somebody already held. Registration numbers probed for a free number
-- but nothing stopped two approvals claiming the same one at the same instant.
-- Neither column had a unique index to catch it.
--
-- Rule below: the student who was created FIRST keeps the number — their
-- documents are the older ones and stay valid. The later student is renumbered
-- and MUST have their Application Form / Registration Certificate / Admit Card
-- re-issued.
--
-- Run in Supabase -> SQL Editor, in order. Step 4 fails if any duplicate is
-- left, which is the point — it will not lock in a broken state.

-- ------------------------------------------------------------
-- 1) Who is about to be renumbered. Read this before going on.
-- ------------------------------------------------------------
SELECT 'admission_number' AS field, s.admission_number AS shared_value,
       s.student_name, s.created_at,
       CASE WHEN s.created_at = min(s.created_at) OVER (PARTITION BY s.admission_number)
            THEN 'keeps it' ELSE 'gets a new one' END AS outcome
FROM students s
WHERE s.admission_number IN (
  SELECT admission_number FROM students
  WHERE admission_number IS NOT NULL AND admission_number <> ''
  GROUP BY admission_number HAVING count(*) > 1
)
UNION ALL
SELECT 'registration_no', s.registration_no, s.student_name, s.created_at,
       CASE WHEN s.created_at = min(s.created_at) OVER (PARTITION BY s.registration_no)
            THEN 'keeps it' ELSE 'gets a new one' END
FROM students s
WHERE s.registration_no IN (
  SELECT registration_no FROM students
  WHERE registration_no IS NOT NULL AND registration_no <> ''
  GROUP BY registration_no HAVING count(*) > 1
)
ORDER BY 1, 2, 4;

-- ------------------------------------------------------------
-- 2) Renumber the later holder of each duplicate APPLICATION number.
--    The new serial continues past the highest one in use for that year, so it
--    cannot land on anything live.
-- ------------------------------------------------------------
WITH dupes AS (
  SELECT id, admission_number,
         substring(admission_number from 'ADM-(\d{4})-') AS yr,
         row_number() OVER (PARTITION BY admission_number ORDER BY created_at, id) AS rn
  FROM students
  WHERE admission_number IS NOT NULL AND admission_number <> ''
    AND admission_number IN (
      SELECT admission_number FROM students
      WHERE admission_number IS NOT NULL AND admission_number <> ''
      GROUP BY admission_number HAVING count(*) > 1
    )
),
to_fix AS (   -- rn = 1 keeps its number; everyone after it is renumbered
  SELECT id, yr, row_number() OVER (ORDER BY id) AS seq FROM dupes WHERE rn > 1
),
top AS (
  SELECT coalesce(max(substring(admission_number from 'ADM-\d{4}-(\d+)$')::int), 0) AS n
  FROM students WHERE admission_number ~ '^ADM-\d{4}-\d+$'
)
UPDATE students s
SET admission_number = 'ADM-' || f.yr || '-' || lpad((t.n + f.seq)::text, 5, '0')
FROM to_fix f, top t
WHERE s.id = f.id;

-- ------------------------------------------------------------
-- 3) Same for duplicate REGISTRATION numbers, keeping each number's own
--    SIU<yy>R prefix so the student stays in their session's series.
-- ------------------------------------------------------------
WITH dupes AS (
  SELECT id, registration_no,
         substring(registration_no from '^(SIU\d{2}R)') AS pfx,
         row_number() OVER (PARTITION BY registration_no ORDER BY created_at, id) AS rn
  FROM students
  WHERE registration_no IS NOT NULL AND registration_no <> ''
    AND registration_no IN (
      SELECT registration_no FROM students
      WHERE registration_no IS NOT NULL AND registration_no <> ''
      GROUP BY registration_no HAVING count(*) > 1
    )
),
to_fix AS (
  SELECT id, pfx, row_number() OVER (PARTITION BY pfx ORDER BY id) AS seq
  FROM dupes WHERE rn > 1
)
UPDATE students s
SET registration_no = f.pfx || (
      (SELECT coalesce(max(substring(x.registration_no from 'R(\d+)$')::int), 1000)
       FROM students x WHERE x.registration_no LIKE f.pfx || '%') + f.seq
    )::text
FROM to_fix f
WHERE s.id = f.id;

-- ------------------------------------------------------------
-- 4) Lock it. These fail loudly if any duplicate survived above — fix it and
--    re-run rather than skipping this step, or the app can drift again.
--    NULLs are ignored, so students still awaiting a number are unaffected.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_admission_number
  ON students (admission_number) WHERE admission_number IS NOT NULL AND admission_number <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_students_registration_no
  ON students (registration_no) WHERE registration_no IS NOT NULL AND registration_no <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_students_enrollment_no
  ON students (enrollment_no) WHERE enrollment_no IS NOT NULL AND enrollment_no <> '';

-- ------------------------------------------------------------
-- 5) Proof. All three should come back empty.
-- ------------------------------------------------------------
SELECT 'admission_number' AS field, admission_number AS value, count(*) AS students
FROM students WHERE admission_number IS NOT NULL AND admission_number <> ''
GROUP BY admission_number HAVING count(*) > 1
UNION ALL
SELECT 'registration_no', registration_no, count(*)
FROM students WHERE registration_no IS NOT NULL AND registration_no <> ''
GROUP BY registration_no HAVING count(*) > 1
UNION ALL
SELECT 'enrollment_no', enrollment_no, count(*)
FROM students WHERE enrollment_no IS NOT NULL AND enrollment_no <> ''
GROUP BY enrollment_no HAVING count(*) > 1;
