-- ============================================================
-- UPDATE: Centers Flow - Approval, Virtual Balance, Recharge
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add center_type to centers (super_center or center)
ALTER TABLE centers ADD COLUMN IF NOT EXISTS center_type TEXT DEFAULT 'super_center'
  CHECK (center_type IN ('super_center', 'center'));

-- 2. Add approval_status
ALTER TABLE centers ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- 3. Add virtual balance
ALTER TABLE centers ADD COLUMN IF NOT EXISTS virtual_balance NUMERIC DEFAULT 0;

-- 4. Add approval notes
ALTER TABLE centers ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- 5. Recharge requests table
CREATE TABLE IF NOT EXISTS recharge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID REFERENCES centers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  utr_number TEXT,
  utr_screenshot_url TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on recharge_requests
ALTER TABLE recharge_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON recharge_requests FOR ALL USING (true) WITH CHECK (true);

SELECT 'Centers flow schema updated successfully.' AS result;
