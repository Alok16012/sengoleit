-- Add Transfer Certificate (TC) and Migration Certificate document URLs to students.
-- Run in Supabase -> SQL Editor.

ALTER TABLE students ADD COLUMN IF NOT EXISTS tc_url text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS migration_url text;
