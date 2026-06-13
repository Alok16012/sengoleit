-- Center pricing (admin-set base fees) + commission tracking columns
-- Run manually in Supabase SQL Editor.

-- 1. Single-row pricing table holding admin-set base prices
CREATE TABLE IF NOT EXISTS center_pricing (
  id INT PRIMARY KEY DEFAULT 1,
  with_letter_price NUMERIC NOT NULL DEFAULT 0,
  without_letter_price NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO center_pricing (id, with_letter_price, without_letter_price)
  VALUES (1, 0, 0)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE center_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read pricing for authenticated" ON center_pricing;
CREATE POLICY "Read pricing for authenticated" ON center_pricing
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage pricing" ON center_pricing;
CREATE POLICY "Admin manage pricing" ON center_pricing
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. Columns on centers for the pricing/commission flow
ALTER TABLE centers ADD COLUMN IF NOT EXISTS amount_paid NUMERIC;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS letter_type TEXT;          -- 'with' | 'without'
ALTER TABLE centers ADD COLUMN IF NOT EXISTS base_fee NUMERIC;          -- admin base for chosen letter type
ALTER TABLE centers ADD COLUMN IF NOT EXISTS commission_credited BOOLEAN DEFAULT false;
