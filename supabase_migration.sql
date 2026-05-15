-- =====================================================
-- SENGOL UNIVERSITY ADMIN - SUPABASE MIGRATION SQL
-- Run this in your NEW Supabase project's SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. COUNTRIES
-- =====================================================
CREATE TABLE IF NOT EXISTS countries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  country_name TEXT NOT NULL,
  country_code TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO countries (country_name, country_code) VALUES ('India', 'IN') ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. STATES
-- =====================================================
CREATE TABLE IF NOT EXISTS states (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  state_name TEXT NOT NULL,
  state_code TEXT,
  country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. DISTRICTS
-- =====================================================
CREATE TABLE IF NOT EXISTS districts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  district_name TEXT NOT NULL,
  state_id UUID REFERENCES states(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. UNIVERSITIES
-- =====================================================
CREATE TABLE IF NOT EXISTS universities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  university_name TEXT NOT NULL,
  registration_number TEXT,
  establishment_year INTEGER,
  university_type TEXT CHECK (university_type IN ('Private', 'State', 'Deemed')),
  email TEXT,
  phone TEXT,
  alternate_phone TEXT,
  website_url TEXT,
  affiliation_details TEXT,
  accreditation_details TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  state_id UUID REFERENCES states(id) ON DELETE SET NULL,
  district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  pincode TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Pending')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. DEPARTMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. PROGRAMME TYPES
-- =====================================================
CREATE TABLE IF NOT EXISTS programme_types (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  programme_type_name TEXT NOT NULL,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO programme_types (programme_type_name) VALUES ('UG'), ('PG'), ('Diploma'), ('Certificate'), ('PhD') ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. MODES OF STUDY
-- =====================================================
CREATE TABLE IF NOT EXISTS modes_of_study (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  mode_name TEXT NOT NULL,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO modes_of_study (mode_name) VALUES ('Regular'), ('Distance'), ('Online'), ('Part-time') ON CONFLICT DO NOTHING;

-- =====================================================
-- 8. STUDY MODES (second table for modes)
-- =====================================================
CREATE TABLE IF NOT EXISTS study_modes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  mode_name TEXT NOT NULL,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO study_modes (mode_name) VALUES ('Regular'), ('Distance'), ('Online'), ('Part-time') ON CONFLICT DO NOTHING;

-- =====================================================
-- 9. PROGRAMS
-- =====================================================
CREATE TABLE IF NOT EXISTS programs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  program_name TEXT NOT NULL,
  course_code TEXT,
  short_name TEXT,
  level TEXT CHECK (level IN ('UG', 'PG')),
  stream TEXT,
  description TEXT,
  duration INTEGER,
  complete_duration TEXT,
  semester_year TEXT,
  seats_limit INTEGER,
  fees_per_year NUMERIC(10,2),
  fees_per_semester NUMERIC(10,2),
  eligibility TEXT,
  university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  programme_type_id UUID REFERENCES programme_types(id) ON DELETE SET NULL,
  mode_id UUID REFERENCES study_modes(id) ON DELETE SET NULL,
  mode_of_study_id UUID REFERENCES modes_of_study(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 10. ACADEMIC SESSIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS academic_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_name TEXT NOT NULL,
  session_period TEXT,
  academic_year TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 11. SCHEMES
-- =====================================================
CREATE TABLE IF NOT EXISTS schemes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  scheme_name TEXT NOT NULL,
  university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
  description TEXT,
  amount_type TEXT CHECK (amount_type IN ('Percentage', 'Fixed', 'Amount')),
  amount_value NUMERIC(10,2),
  scholarship TEXT DEFAULT 'No',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 12. CENTERS
-- =====================================================
CREATE TABLE IF NOT EXISTS centers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  center_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  address_line1 TEXT,
  landmark TEXT,
  post_office TEXT,
  city TEXT,
  pincode TEXT,
  organization_name TEXT,
  date_of_submission DATE,
  super_center_id UUID REFERENCES centers(id) ON DELETE SET NULL,
  contact_person TEXT,
  father_mother_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  nationality TEXT DEFAULT 'Indian',
  aadhar_no TEXT,
  pan_no TEXT,
  country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  state_id UUID REFERENCES states(id) ON DELETE SET NULL,
  district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  org_type TEXT,
  org_address TEXT,
  org_post_office TEXT,
  org_city TEXT,
  org_pincode TEXT,
  org_country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  org_state_id UUID REFERENCES states(id) ON DELETE SET NULL,
  org_district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  registration_number TEXT,
  gst_pan TEXT,
  premises_type TEXT CHECK (premises_type IN ('Owned', 'Rented', 'Leased')),
  office_area_sqft NUMERIC,
  student_capacity INTEGER,
  revenue_share_percentage NUMERIC DEFAULT 50,
  bank_account_holder TEXT,
  bank_account_number TEXT,
  ifsc_code TEXT,
  bank_branch TEXT,
  edu_10th_institute TEXT,
  edu_10th_board TEXT,
  edu_10th_year TEXT,
  edu_12th_institute TEXT,
  edu_12th_board TEXT,
  edu_12th_year TEXT,
  edu_ug_institute TEXT,
  edu_ug_board TEXT,
  edu_ug_year TEXT,
  edu_pg_institute TEXT,
  edu_pg_board TEXT,
  edu_pg_year TEXT,
  edu_diploma_institute TEXT,
  edu_diploma_board TEXT,
  edu_diploma_year TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Active', 'Inactive')),
  kyc_status TEXT DEFAULT 'Pending' CHECK (kyc_status IN ('Pending', 'Verified')),
  center_code TEXT UNIQUE,
  generated_password TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 13. CENTER APPLICATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS center_applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name TEXT NOT NULL,
  fathers_mothers_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  nationality TEXT DEFAULT 'Indian',
  aadhar_no TEXT,
  pan_no TEXT,
  email TEXT,
  phone TEXT,
  date_of_submission DATE,
  date_of_creation DATE,
  university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
  super_center TEXT,
  permanent_address TEXT,
  permanent_post_office TEXT,
  permanent_city TEXT,
  permanent_state_id UUID REFERENCES states(id) ON DELETE SET NULL,
  permanent_district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  permanent_pin_code TEXT,
  organization_name TEXT,
  type_of_organization TEXT CHECK (type_of_organization IN ('Education Consultancy', 'Institute', 'NGO', 'Other')),
  organization_address TEXT,
  org_post_office TEXT,
  org_city TEXT,
  org_state_id UUID REFERENCES states(id) ON DELETE SET NULL,
  org_district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
  org_pin_code TEXT,
  organization_registration_no TEXT,
  gst_pan_of_organization TEXT,
  premises_type TEXT CHECK (premises_type IN ('Owned', 'Rented', 'Leased')) DEFAULT 'Owned',
  office_area_sq_ft NUMERIC,
  account_holder_name TEXT,
  account_no TEXT,
  ifc_code TEXT,
  branch TEXT,
  tenth_institute_name TEXT,
  tenth_board_university TEXT,
  tenth_passing_year TEXT,
  twelfth_institute_name TEXT,
  twelfth_board_university TEXT,
  twelfth_passing_year TEXT,
  ug_institute_name TEXT,
  ug_board_university TEXT,
  ug_passing_year TEXT,
  pg_institute_name TEXT,
  pg_board_university TEXT,
  pg_passing_year TEXT,
  diploma_institute_name TEXT,
  diploma_board_university TEXT,
  diploma_passing_year TEXT,
  photo_url TEXT,
  aadhar_upload_url TEXT,
  pan_upload_url TEXT,
  marksheet_url TEXT,
  signature_url TEXT,
  organization_registration_no_url TEXT,
  premises_pic_url TEXT,
  cancel_cheque_url TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 14. STUDENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_name TEXT NOT NULL,
  enrollment_no TEXT,
  admission_number TEXT,
  registration_no TEXT,
  course_code TEXT,
  semester_year TEXT,
  academic_year TEXT,
  date_of_admission DATE,
  date_of_birth DATE,
  gender TEXT,
  nationality TEXT DEFAULT 'Indian',
  blood_group TEXT,
  caste TEXT,
  religion TEXT,
  mother_tongue TEXT,
  physically_handicapped TEXT DEFAULT 'No',
  scholarship_applied TEXT DEFAULT 'No',
  aadhar_no TEXT,
  pan_no TEXT,
  aadhar_link_mobile TEXT,
  mobile_no TEXT,
  whatsapp_no TEXT,
  university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
  session_id UUID REFERENCES academic_sessions(id) ON DELETE SET NULL,
  programme_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  mode_id UUID REFERENCES study_modes(id) ON DELETE SET NULL,
  center_id UUID REFERENCES centers(id) ON DELETE SET NULL,
  center_name TEXT,
  student_pres_village_town TEXT,
  student_pres_landmark TEXT,
  student_pres_post_office TEXT,
  student_pres_city TEXT,
  student_pres_state TEXT,
  student_pres_district TEXT,
  student_pres_pin_code TEXT,
  student_perm_village_town TEXT,
  student_perm_landmark TEXT,
  student_perm_post_office TEXT,
  student_perm_city TEXT,
  student_perm_state TEXT,
  student_perm_district TEXT,
  student_perm_pin_code TEXT,
  fathers_name TEXT,
  fathers_occupation TEXT,
  mothers_name TEXT,
  mothers_occupation TEXT,
  guardian_name TEXT,
  guardian_relation TEXT,
  tenth_board_university TEXT,
  tenth_institute_name TEXT,
  tenth_passing_year TEXT,
  tenth_obtained_marks TEXT,
  tenth_total_marks TEXT,
  twelfth_board_university TEXT,
  twelfth_institute_name TEXT,
  twelfth_passing_year TEXT,
  twelfth_obtained_marks TEXT,
  twelfth_total_marks TEXT,
  ug_board_university TEXT,
  ug_institute_name TEXT,
  ug_passing_year TEXT,
  ug_obtained_marks TEXT,
  ug_total_marks TEXT,
  pg_board_university TEXT,
  pg_institute_name TEXT,
  pg_passing_year TEXT,
  pg_obtained_marks TEXT,
  pg_total_marks TEXT,
  diploma_board_university TEXT,
  diploma_institute_name TEXT,
  diploma_passing_year TEXT,
  diploma_obtained_marks TEXT,
  diploma_total_marks TEXT,
  status TEXT DEFAULT 'Pending',
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 15. DOCUMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entity_type TEXT,
  entity_id UUID,
  center_id UUID REFERENCES centers(id) ON DELETE SET NULL,
  document_url TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 16. PROFILES (links to auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT DEFAULT 'center' CHECK (role IN ('admin', 'center', 'student')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'role', 'center'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE states ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE modes_of_study ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_modes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all reference data
DROP POLICY IF EXISTS "Read for authenticated" ON countries;
DROP POLICY IF EXISTS "Read for authenticated" ON states;
DROP POLICY IF EXISTS "Read for authenticated" ON districts;
DROP POLICY IF EXISTS "Read for authenticated" ON programme_types;
DROP POLICY IF EXISTS "Read for authenticated" ON modes_of_study;
DROP POLICY IF EXISTS "Read for authenticated" ON study_modes;
CREATE POLICY "Read for authenticated" ON countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read for authenticated" ON states FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read for authenticated" ON districts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read for authenticated" ON programme_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read for authenticated" ON modes_of_study FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read for authenticated" ON study_modes FOR SELECT TO authenticated USING (true);

-- Admins: full access to everything
DROP POLICY IF EXISTS "Admin full access" ON universities;
DROP POLICY IF EXISTS "Admin full access" ON programs;
DROP POLICY IF EXISTS "Admin full access" ON centers;
DROP POLICY IF EXISTS "Admin full access" ON students;
DROP POLICY IF EXISTS "Admin full access" ON departments;
DROP POLICY IF EXISTS "Admin full access" ON schemes;
DROP POLICY IF EXISTS "Admin full access" ON academic_sessions;
DROP POLICY IF EXISTS "Admin full access" ON center_applications;
CREATE POLICY "Admin full access" ON universities TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access" ON programs TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access" ON centers TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access" ON students TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access" ON departments TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access" ON schemes TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access" ON academic_sessions TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access" ON center_applications TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin manage locations" ON countries;
DROP POLICY IF EXISTS "Admin manage locations" ON states;
DROP POLICY IF EXISTS "Admin manage locations" ON districts;
CREATE POLICY "Admin manage locations" ON countries TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin manage locations" ON states TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin manage locations" ON districts TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Centers: read universities, programs, sessions; manage own students
DROP POLICY IF EXISTS "Center read reference" ON universities;
DROP POLICY IF EXISTS "Center read programs" ON programs;
DROP POLICY IF EXISTS "Center read sessions" ON academic_sessions;
DROP POLICY IF EXISTS "Center read departments" ON departments;
CREATE POLICY "Center read reference" ON universities FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'center')
);
CREATE POLICY "Center read programs" ON programs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'center')
);
CREATE POLICY "Center read sessions" ON academic_sessions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'center')
);
CREATE POLICY "Center read departments" ON departments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'center')
);

-- Centers manage own students
DROP POLICY IF EXISTS "Center manage own students" ON students;
CREATE POLICY "Center manage own students" ON students TO authenticated USING (
  EXISTS (SELECT 1 FROM centers WHERE id = students.center_id AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM centers WHERE id = center_id AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- Centers view/update own center
DROP POLICY IF EXISTS "Center own record" ON centers;
CREATE POLICY "Center own record" ON centers TO authenticated USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Center applications
DROP POLICY IF EXISTS "Submit application" ON center_applications;
DROP POLICY IF EXISTS "Read own application" ON center_applications;
CREATE POLICY "Submit application" ON center_applications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Read own application" ON center_applications FOR SELECT TO authenticated USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Profiles
DROP POLICY IF EXISTS "Own profile" ON profiles;
CREATE POLICY "Own profile" ON profiles TO authenticated USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =====================================================
-- STORAGE BUCKET
-- =====================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Authenticated upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read documents" ON storage.objects;
CREATE POLICY "Authenticated upload documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Public read documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents');

-- =====================================================
-- DONE! Now:
-- 1. Copy your Supabase URL and anon key to .env file
-- 2. Run: npm run dev
-- =====================================================
