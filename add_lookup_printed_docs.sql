-- Students -> lookup role: the documents the Exam Section has printed, shown
-- in the Result column and opened again to view. A staff role with Students ->
-- View may read which documents were printed and the certificate numbers.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

INSERT INTO perm_table_access (perm, table_name, access) VALUES
  ('students.view', 'print_documents',     'r'),
  ('students.view', 'certificate_numbers', 'r')
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS staff_read ON print_documents;
CREATE POLICY staff_read ON print_documents FOR SELECT TO authenticated USING (staff_can('print_documents', 'r'));
DROP POLICY IF EXISTS staff_read ON certificate_numbers;
CREATE POLICY staff_read ON certificate_numbers FOR SELECT TO authenticated USING (staff_can('certificate_numbers', 'r'));

NOTIFY pgrst, 'reload schema';

SELECT 'lookup printed documents ready' AS result;
