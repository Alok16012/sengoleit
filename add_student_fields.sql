-- =====================================================
-- Run this in Supabase SQL Editor
-- Adds missing student fields from Excel requirement
-- =====================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_submission DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS entry_type TEXT CHECK (entry_type IN ('Regular', 'Lateral', 'External'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS profession TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS identification_marks TEXT;

-- Guardian extra details
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_occupation TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_email TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_mobile TEXT;

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
