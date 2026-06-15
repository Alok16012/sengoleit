-- Per-super-center pricing + commission tracking columns
-- Run manually in Supabase SQL Editor.

-- 1. Pricing columns set by admin ON EACH super center row.
--    A center created under a super center charges based on ITS super center's prices.
ALTER TABLE centers ADD COLUMN IF NOT EXISTS with_letter_price NUMERIC DEFAULT 0;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS without_letter_price NUMERIC DEFAULT 0;

-- 2. Columns on the created center for the pricing/commission flow
ALTER TABLE centers ADD COLUMN IF NOT EXISTS amount_paid NUMERIC;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS letter_type TEXT;          -- 'with' | 'without'
ALTER TABLE centers ADD COLUMN IF NOT EXISTS base_fee NUMERIC;          -- super center base for chosen letter type (snapshot)
ALTER TABLE centers ADD COLUMN IF NOT EXISTS commission_credited BOOLEAN DEFAULT false;

-- 3. The earlier global single-row pricing table is no longer used.
DROP TABLE IF EXISTS center_pricing;
