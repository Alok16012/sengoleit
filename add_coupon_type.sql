-- Distinguish coupon kinds in Coupon Management.
--   'discount' : a discount coupon (default — existing wallet-minted coupons)
--   'approval' : an admission approval code
-- Existing rows become 'discount' so current behaviour is unchanged.
-- Run in Supabase -> SQL Editor.

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS coupon_type text NOT NULL DEFAULT 'discount';
