-- Exam Section -> Print: the Date of Issue a Provisional / Migration / Degree
-- certificate was FIRST printed with is kept on the document, so View and
-- Reprint print that same date (not today's) and History shows it.
--
-- Documents printed before this existed keep the date of their first print.
-- Run once in Supabase -> SQL Editor. Safe to re-run.

ALTER TABLE print_documents ADD COLUMN IF NOT EXISTS issue_date date;

-- Earlier prints: the day they were first printed (India time).
UPDATE print_documents
   SET issue_date = (first_printed_at AT TIME ZONE 'Asia/Kolkata')::date
 WHERE issue_date IS NULL AND first_printed_at IS NOT NULL AND semester = 0;

-- Set once, on the first print; never changed by a reprint.
-- p_items: [{ student_id, doc_type, issue_date: 'yyyy-mm-dd' }]
CREATE OR REPLACE FUNCTION set_print_issue_dates(p_items jsonb)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE it jsonb;
BEGIN
  IF NOT (is_admin() OR staff_can('print_documents', 'w')) THEN
    RAISE EXCEPTION 'Not allowed to record printed documents.';
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) LOOP
    UPDATE print_documents
       SET issue_date = (it ->> 'issue_date')::date
     WHERE student_id = (it ->> 'student_id')::uuid
       AND doc_type = upper(it ->> 'doc_type')
       AND semester = 0
       AND issue_date IS NULL;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION set_print_issue_dates(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'print issue date ready' AS result;

-- Correct a printed certificate's Date of Issue to the date actually on the
-- paper (Print History -> Date of Issue -> edit). Overwrites.
CREATE OR REPLACE FUNCTION change_print_issue_date(p_student uuid, p_doc_type text, p_date date)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (is_admin() OR staff_can('print_documents', 'w')) THEN
    RAISE EXCEPTION 'Not allowed to change a printed document.';
  END IF;
  IF p_date IS NULL THEN RAISE EXCEPTION 'Pick a date.'; END IF;
  UPDATE print_documents SET issue_date = p_date, updated_at = now()
   WHERE student_id = p_student AND doc_type = upper(p_doc_type) AND semester = 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'This document has not been printed yet.'; END IF;
END $$;

GRANT EXECUTE ON FUNCTION change_print_issue_date(uuid, text, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
