-- =====================================================
-- CLEAN ALL TEST / DEMO DATA
-- Run in Supabase SQL Editor
-- Keeps: states, districts, countries (location data)
-- Removes: students, centers, programs, universities,
--          sessions, schemes, departments, etc.
-- =====================================================

-- Disable FK checks temporarily via truncate cascade
TRUNCATE TABLE students RESTART IDENTITY CASCADE;
TRUNCATE TABLE centers RESTART IDENTITY CASCADE;
TRUNCATE TABLE programs RESTART IDENTITY CASCADE;
TRUNCATE TABLE schemes RESTART IDENTITY CASCADE;
TRUNCATE TABLE academic_sessions RESTART IDENTITY CASCADE;
TRUNCATE TABLE departments RESTART IDENTITY CASCADE;
TRUNCATE TABLE programme_types RESTART IDENTITY CASCADE;
TRUNCATE TABLE study_modes RESTART IDENTITY CASCADE;
TRUNCATE TABLE modes_of_study RESTART IDENTITY CASCADE;
TRUNCATE TABLE universities RESTART IDENTITY CASCADE;

-- Clean profiles except admin
DELETE FROM profiles WHERE role != 'admin';

SELECT 'All test data cleaned successfully.' AS result;
