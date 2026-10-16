-- Certificate numbers for the final certificates.
--
-- WHY
--   The Provisional Certificate carries a QR code with the student's name,
--   enrollment number and the certificate's own unique number. That number is
--   random — not a running serial, so one certificate's number says nothing
--   about the next — and it is issued once: every reprint of the same
--   certificate carries the same number, so a printed copy can always be
--   checked against this table.
--
--   certificate_numbers — one row per student per certificate.
--   issue_certificate_no() — returns the student's number for a certificate,
--                            issuing a fresh random one the first time.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS certificate_numbers (
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  doc_type    text NOT NULL CHECK (doc_type IN ('PROVISIONAL','MIGRATION','DEGREE')),
  cert_no     text NOT NULL UNIQUE,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  issued_by   text,
  PRIMARY KEY (student_id, doc_type)
);

-- Read by the admin; written only by the function below.
ALTER TABLE certificate_numbers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS certificate_numbers_admin_read ON certificate_numbers;
CREATE POLICY certificate_numbers_admin_read ON certificate_numbers FOR SELECT USING (is_admin());

-- A 5-digit random number, never starting with 0 (10000–99999). If it is
-- already taken (by anyone), another is drawn; two calls for the same
-- certificate at once both end up with the one that was stored.
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
