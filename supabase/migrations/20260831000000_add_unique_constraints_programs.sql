-- Migration to add unique constraints on programs table for course_code and enrollment_code.
-- Run this in Supabase -> SQL Editor.
--
-- This ensures Course Code and Enrollment Code cannot have duplicate values,
-- and cannot be the same value (though the form also validates this on the client).

-- First, ensure existing data is clean (no duplicates).
-- If this fails, clean up the duplicates first.

-- Add unique constraint on course_code (allowing NULLs if some programs don't use it)
CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_course_code_unique
  ON programs(course_code)
  WHERE course_code IS NOT NULL AND course_code <> '';

-- Add unique constraint on enrollment_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_enrollment_code_unique
  ON programs(enrollment_code)
  WHERE enrollment_code IS NOT NULL AND enrollment_code <> '';
