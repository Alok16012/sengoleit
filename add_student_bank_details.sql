-- Bank account details captured in the student admission form (Basic Entry).
-- Run in Supabase -> SQL Editor.

ALTER TABLE students ADD COLUMN IF NOT EXISTS bank_account_holder text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS bank_account_number text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS ifsc_code text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS bank_branch text;
