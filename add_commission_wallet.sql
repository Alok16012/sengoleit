-- Commission Wallet for Super Centers
-- Commission = amount charged to student - base fee (with/without letter price)
-- Run this in Supabase SQL Editor

-- 1. Add commission balance to centers table (for super centers)
ALTER TABLE centers ADD COLUMN IF NOT EXISTS commission_balance NUMERIC DEFAULT 0;

-- 2. Create commission ledger to track all commission transactions
CREATE TABLE IF NOT EXISTS commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_center_id UUID NOT NULL REFERENCES centers(id),
  center_id UUID REFERENCES centers(id),
  student_id UUID REFERENCES students(id),
  amount NUMERIC NOT NULL,
  base_fee NUMERIC NOT NULL,
  charged_amount NUMERIC NOT NULL,
  kind TEXT NOT NULL, -- 'admission', 're_registration', 'exam_balance', 'adjustment'
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE commission_ledger ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "Admins can read commission_ledger"
  ON commission_ledger FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert commission_ledger"
  ON commission_ledger FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 5. Index for faster queries
CREATE INDEX IF NOT EXISTS idx_commission_ledger_super_center 
  ON commission_ledger(super_center_id, created_at DESC);
