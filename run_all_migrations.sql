-- ============================================================
-- SENGOL ADMIN — ALL PENDING MIGRATIONS (run once)
-- Copy this whole file into Supabase -> SQL Editor and click RUN.
-- Every statement is idempotent (IF NOT EXISTS), so it is safe to
-- run again even if some columns/tables already exist.
-- ============================================================

-- 1) Transfer Certificate (TC) + Migration Certificate document URLs
ALTER TABLE students ADD COLUMN IF NOT EXISTS tc_url text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS migration_url text;

-- 2) Forward-to-Exam-Section tracking
--    Admit card is generated ONLY in the Exam Section, after this is set.
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_forwarded_at timestamptz;

-- 3) Bank account details (student admission form — Basic Entry)
ALTER TABLE students ADD COLUMN IF NOT EXISTS bank_account_holder text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS bank_account_number text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS ifsc_code text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS bank_branch text;

-- 4) Exam Section — admit card release + exam result columns
ALTER TABLE students ADD COLUMN IF NOT EXISTS admit_card_released_at timestamptz;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_status text;          -- Pending / Pass / Fail
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_obtained_marks numeric;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_total_marks numeric;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_marksheet_url text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_declared_at timestamptz;
ALTER TABLE students ADD COLUMN IF NOT EXISTS exam_result_remarks text;

-- 5) Coupon kind: 'discount' (default) vs 'approval' (admission approval code)
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS coupon_type text NOT NULL DEFAULT 'discount';

-- 6) Center course allotment (Fee Management -> "Center Courses")
CREATE TABLE IF NOT EXISTS center_courses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id        uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  fee_structure_id uuid NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending',   -- 'pending' | 'approved'
  created_at       timestamptz NOT NULL DEFAULT now(),
  approved_at      timestamptz,
  UNIQUE (center_id, fee_structure_id)
);
CREATE INDEX IF NOT EXISTS idx_center_courses_center ON center_courses(center_id);
CREATE INDEX IF NOT EXISTS idx_center_courses_status ON center_courses(status);

-- 7) Syllabus subjects (per program + session) -> Admit Card "Papers to be appeared"
CREATE TABLE IF NOT EXISTS syllabus_subjects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  session_id   uuid REFERENCES academic_sessions(id) ON DELETE CASCADE,  -- null = all sessions
  semester     integer,
  paper_no     text,
  subject_code text,
  subject_name text,
  pdf_url      text,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE syllabus_subjects ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE syllabus_subjects ADD COLUMN IF NOT EXISTS criteria text;
CREATE INDEX IF NOT EXISTS idx_syllabus_program ON syllabus_subjects(program_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_session ON syllabus_subjects(session_id);

-- 8) Course-level full-syllabus PDF (one PDF per program + session),
--    uploaded from the Syllabus list "Upload PDF" action.
CREATE TABLE IF NOT EXISTS course_syllabus_pdfs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  session_id  uuid REFERENCES academic_sessions(id) ON DELETE CASCADE,  -- null = all sessions
  pdf_url     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_pdf_program ON course_syllabus_pdfs(program_id);

-- 9) Global key/value settings. Used by the Exam Section to store the
--    section-wide Exam Schedule and Admit Card date/time, printed on Admit Cards.
CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_settings (key, value)
VALUES ('exam_schedule', NULL), ('admit_card_time', NULL)
ON CONFLICT (key) DO NOTHING;

-- 10) Per-course (program + session) exam settings: Exam Schedule + Admit Card
--     date/time. Printed on Admit Cards and used to gate admit-card generation.
CREATE TABLE IF NOT EXISTS exam_schedules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  session_id      uuid REFERENCES academic_sessions(id) ON DELETE CASCADE,
  exam_schedule   text,
  admit_card_time text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_program ON exam_schedules(program_id);

-- 11) Student height (Personal Info).
ALTER TABLE students ADD COLUMN IF NOT EXISTS height text;

-- 12) Per-program minimum required prior education level (Programs page).
--     1=10th, 2=12th, 3=UG, 4=PG, 5=MPhil. null = no requirement.
ALTER TABLE programs ADD COLUMN IF NOT EXISTS required_education_level smallint;

-- 13) Additional student education levels: MPhil and Others.
ALTER TABLE students ADD COLUMN IF NOT EXISTS mphil_institute_name   text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mphil_board_university text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mphil_passing_year     text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mphil_obtained_marks   text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mphil_total_marks      text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mphil_marksheet_url    text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS others_institute_name   text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS others_board_university text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS others_passing_year     text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS others_obtained_marks   text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS others_total_marks      text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS others_marksheet_url    text;

-- 14) Approval-code activation (Super Center → Approval Code).
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS activation_email text;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_activated boolean NOT NULL DEFAULT false;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS activated_at timestamptz;

-- Done.
SELECT 'all migrations applied' AS result;
