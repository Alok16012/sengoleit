-- Adds a column to record WHICH form fields the Document Department flagged for
-- correction when it holds a STUDENT application. On resubmit, the center can only
-- edit these specific fields/documents — every verified field stays locked.
--
-- Run this once in Supabase → SQL Editor.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS correction_fields jsonb;

-- correction_fields holds a JSON array of StudentForm field names, e.g.
--   ["student_name", "aadhar_no", "photo_url", "student_perm_pin_code"]
-- NULL or empty array  => nothing specific was flagged (whole form stays editable).
