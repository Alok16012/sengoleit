-- Certificate numbers: 5 digits instead of 10.
--
-- WHY
--   The certificate number in the Provisional Certificate's QR was a 10-digit
--   random number; the office wants a shorter one. It stays random — not a
--   running serial — and is still issued once per student per certificate, so
--   every reprint carries the same number.
--
--   issue_certificate_no() now draws from 10000–99999, and every number
--   already issued in the old 10-digit form is re-issued as a 5-digit one
--   (only certificates printed for testing so far carry those).
--
-- Run once in Supabase -> SQL Editor, after add_certificate_numbers.sql.
-- Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION issue_certificate_no(p_student uuid, p_doc_type text)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type text := upper(COALESCE(p_doc_type, ''));
  v_no   text;
  v_by   text := COALESCE(NULLIF(auth.jwt() ->> 'email', ''), auth.uid()::text, 'admin');
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can issue certificate numbers.';
  END IF;
  IF v_type NOT IN ('PROVISIONAL','MIGRATION','DEGREE') THEN
    RAISE EXCEPTION 'Unknown certificate: %', p_doc_type;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student) THEN
    RAISE EXCEPTION 'No such student.';
  END IF;

  FOR i IN 1..50 LOOP
    SELECT c.cert_no INTO v_no FROM certificate_numbers c
     WHERE c.student_id = p_student AND c.doc_type = v_type;
    IF v_no IS NOT NULL THEN RETURN v_no; END IF;

    INSERT INTO certificate_numbers (student_id, doc_type, cert_no, issued_by)
    VALUES (p_student, v_type, (10000 + floor(random() * 90000))::int::text, v_by)
    ON CONFLICT DO NOTHING;
  END LOOP;
  RAISE EXCEPTION 'Could not issue a certificate number — please try again.';
END $$;

REVOKE ALL ON FUNCTION issue_certificate_no(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_certificate_no(uuid, text) TO authenticated;

-- Re-issue the numbers given out in the old 10-digit form.
DO $$
DECLARE
  r     record;
  v_new text;
BEGIN
  FOR r IN SELECT student_id, doc_type FROM certificate_numbers WHERE length(cert_no) <> 5 LOOP
    LOOP
      v_new := (10000 + floor(random() * 90000))::int::text;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM certificate_numbers WHERE cert_no = v_new);
    END LOOP;
    UPDATE certificate_numbers SET cert_no = v_new, issued_at = now()
     WHERE student_id = r.student_id AND doc_type = r.doc_type;
  END LOOP;
END $$;

SELECT student_id, doc_type, cert_no, issued_at FROM certificate_numbers ORDER BY issued_at DESC;
