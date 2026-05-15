-- ============================================================
-- COMPLETE STUDENT TABLE MIGRATION
-- Adds ALL fields required by StudentForm
-- Safe to run multiple times (IF NOT EXISTS)
-- Run in Supabase SQL Editor
-- ============================================================

-- Basic entry fields
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_submission DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS entry_type TEXT CHECK (entry_type IN ('Regular', 'Lateral', 'External'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_number TEXT;

-- FK fields (add if not exists)
ALTER TABLE students ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES academic_sessions(id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS programme_id UUID REFERENCES programs(id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS mode_id UUID REFERENCES study_modes(id);

-- Personal information
ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS profession TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_no TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_tongue TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS physically_handicapped TEXT DEFAULT 'No';
ALTER TABLE students ADD COLUMN IF NOT EXISTS aadhar_link_mobile TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS aadhar_no TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS pan_no TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS scholarship_applied TEXT DEFAULT 'None';
ALTER TABLE students ADD COLUMN IF NOT EXISTS identification_marks TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS registration_no TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_year TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Family details
ALTER TABLE students ADD COLUMN IF NOT EXISTS fathers_occupation TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mothers_occupation TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_relation TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_occupation TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_email TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_mobile TEXT;

-- Student Permanent Address
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_perm_village_town TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_perm_landmark TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_perm_post_office TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_perm_city TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_perm_state TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_perm_district TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_perm_pin_code TEXT;

-- Student Present Address
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_pres_village_town TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_pres_landmark TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_pres_post_office TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_pres_city TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_pres_state TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_pres_district TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_pres_pin_code TEXT;

-- Guardian Present Address
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_pres_village_town TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_pres_landmark TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_pres_post_office TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_pres_city TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_pres_state TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_pres_district TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_pres_pin_code TEXT;

-- Guardian Permanent Address
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_perm_village_town TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_perm_landmark TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_perm_post_office TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_perm_city TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_perm_state TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_perm_district TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_perm_pin_code TEXT;

-- Education: 10th
ALTER TABLE students ADD COLUMN IF NOT EXISTS tenth_institute_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS tenth_board_university TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS tenth_passing_year TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS tenth_obtained_marks TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS tenth_total_marks TEXT;

-- Education: 12th
ALTER TABLE students ADD COLUMN IF NOT EXISTS twelfth_institute_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS twelfth_board_university TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS twelfth_passing_year TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS twelfth_obtained_marks TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS twelfth_total_marks TEXT;

-- Education: UG
ALTER TABLE students ADD COLUMN IF NOT EXISTS ug_institute_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS ug_board_university TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS ug_passing_year TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS ug_obtained_marks TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS ug_total_marks TEXT;

-- Education: PG
ALTER TABLE students ADD COLUMN IF NOT EXISTS pg_institute_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS pg_board_university TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS pg_passing_year TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS pg_obtained_marks TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS pg_total_marks TEXT;

-- Education: Diploma
ALTER TABLE students ADD COLUMN IF NOT EXISTS diploma_institute_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS diploma_board_university TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS diploma_passing_year TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS diploma_obtained_marks TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS diploma_total_marks TEXT;

-- Centers table: add email if missing (needed for portal login)
ALTER TABLE centers ADD COLUMN IF NOT EXISTS email TEXT;

SELECT 'Student table migration complete.' AS result;
