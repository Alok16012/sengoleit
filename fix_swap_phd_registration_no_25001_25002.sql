-- Ph.D Registration No. given to the wrong two candidates — swap them:
--   Satarupa Chakrabarti (ADM-2025-00061)  SIUPHDPE25001 -> SIUPHDPE25002
--   Anima Shee           (ADM-2025-00003)  SIUPHDPE25002 -> SIUPHDPE25001
--
-- The number lives in two places and both are swapped: the student's own
-- record, and the Registration Certificate's serial (which is what the
-- Research Dept prints the number from).
--
-- Run once in Supabase -> SQL Editor. It only acts while the two numbers are
-- exactly as above, so a second run changes nothing. The table at the end
-- shows what each candidate holds now.

DO $$
DECLARE
  a uuid; b uuid; na int; nb int;
BEGIN
  SELECT id INTO a FROM students WHERE admission_number = 'ADM-2025-00061' AND enrollment_no = 'SIUPHDPE25001';
  SELECT id INTO b FROM students WHERE admission_number = 'ADM-2025-00003' AND enrollment_no = 'SIUPHDPE25002';
  IF a IS NULL OR b IS NULL THEN
    RAISE NOTICE 'Nothing swapped: the two candidates do not hold SIUPHDPE25001 / SIUPHDPE25002 as expected (already swapped?).';
    RETURN;
  END IF;

  -- A number can belong to one student at a time, so one is cleared first.
  UPDATE students SET enrollment_no = NULL            WHERE id = a;
  UPDATE students SET enrollment_no = 'SIUPHDPE25001' WHERE id = b;
  UPDATE students SET enrollment_no = 'SIUPHDPE25002' WHERE id = a;

  SELECT num INTO na FROM letter_refs WHERE letter_name = 'Enrollment Certificate' AND student_id = a;
  SELECT num INTO nb FROM letter_refs WHERE letter_name = 'Enrollment Certificate' AND student_id = b;
  IF na IS NOT NULL AND nb IS NOT NULL THEN
    UPDATE letter_refs SET num = nb WHERE letter_name = 'Enrollment Certificate' AND student_id = a;
    UPDATE letter_refs SET num = na WHERE letter_name = 'Enrollment Certificate' AND student_id = b;
  END IF;
END $$;

SELECT s.student_name, s.admission_number, s.enrollment_no AS registration_no,
       r.num AS registration_certificate_serial
  FROM students s
  LEFT JOIN letter_refs r ON r.student_id = s.id AND r.letter_name = 'Enrollment Certificate'
 WHERE s.admission_number IN ('ADM-2025-00061', 'ADM-2025-00003')
 ORDER BY s.admission_number;
