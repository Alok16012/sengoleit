-- ============================================================
-- Coupon Wallet Balance
-- ------------------------------------------------------------
-- The Account Dept now just DEPOSITS the paid amount into each
-- center's coupon wallet at approval time. The decision of HOW
-- MANY coupons to mint (paid amount ÷ per-coupon rate) is taken
-- later, inside Coupon Management.
--
-- This adds the balance column that holds the un-minted money.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS coupon_wallet_balance numeric NOT NULL DEFAULT 0;

SELECT 'centers.coupon_wallet_balance ready' AS result;
