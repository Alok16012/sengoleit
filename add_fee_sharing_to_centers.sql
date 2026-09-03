-- Fee Sharing and Commission columns for centers table
-- Run this in Supabase SQL Editor BEFORE git push

ALTER TABLE centers ADD COLUMN IF NOT EXISTS fee_sharing NUMERIC DEFAULT 0;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS commission NUMERIC DEFAULT 0;

COMMENT ON COLUMN centers.fee_sharing IS 'Percentage share of the center in fee (e.g., 50 means 50%)';
COMMENT ON COLUMN centers.commission IS 'Commission amount earned by the super center';
