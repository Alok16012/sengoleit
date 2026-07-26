-- NOC Letter document for Ph.D students.
-- The Documents step shows an "NOC Letter" upload only for Ph.D entries and
-- saves the file URL here. The form degrades gracefully if this column is
-- missing, so run this once in Supabase -> SQL Editor to persist it.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS noc_url text;

SELECT 'students.noc_url ready' AS result;
