-- Staff lookup roles: results, admit cards and marksheets, and uploading a
-- student's missing documents.
--
-- portal_results / portal_declared_semesters / portal_admit_cards /
-- portal_marksheet answered the admin in full and a centre for its own
-- students — a staff login got nothing, so a lookup role saw no result even
-- for a student who had one. Their admin check now also accepts a staff role
-- with Students → View or Exam Section → View (has_any_perm is still true for
-- the admin).
--
-- 'Upload missing documents' (students.upload_docs) may write the student row.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

INSERT INTO perm_table_access (perm, table_name, access)
VALUES ('students.upload_docs', 'students', 'w')
ON CONFLICT DO NOTHING;

DO $$
DECLARE f record; def text;
BEGIN
  FOR f IN SELECT p.oid FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace
             AND p.proname IN ('portal_results', 'portal_declared_semesters', 'portal_admit_cards', 'portal_marksheet') LOOP
    def := pg_get_functiondef(f.oid);
    IF position('is_admin()' IN def) > 0 THEN
      EXECUTE replace(def, 'is_admin()', 'has_any_perm(ARRAY[''students.view'',''exam_section.view''])');
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'staff lookup access ready' AS result;
