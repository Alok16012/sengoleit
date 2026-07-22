-- Aadhar Back document URL on students. The Documents step now uploads the
-- Aadhar front (aadhar_url) and back (aadhar_back_url) separately.
-- Run once in Supabase -> SQL Editor.

ALTER TABLE students ADD COLUMN IF NOT EXISTS aadhar_back_url text;

SELECT 'aadhar_back_url ready' AS result;
