-- One-time cleanup: zero out the coupon-wallet balance for every center EXCEPT
-- Kalawati Computer Center. These balances are deposited money waiting to be
-- minted into coupons; clearing them empties the "Coupon Wallets — Mint Coupons"
-- cards so the screen is fresh for re-testing.
--
-- Run in Supabase -> SQL Editor. Run STEP 1 first to confirm, then STEP 2.

-- STEP 1 — Preview which centers currently hold a coupon-wallet balance.
SELECT center_name, center_code, coupon_wallet_balance
FROM centers
WHERE COALESCE(coupon_wallet_balance, 0) > 0
ORDER BY center_name;

-- STEP 2 — Reset every center's coupon wallet to 0 EXCEPT Kalawati Computer Center.
UPDATE centers
SET coupon_wallet_balance = 0
WHERE center_name <> 'Kalawati Computer Center'
  AND COALESCE(coupon_wallet_balance, 0) > 0;

-- STEP 3 — Verify nothing remains (Kalawati only, if it has a balance).
SELECT center_name, coupon_wallet_balance
FROM centers
WHERE COALESCE(coupon_wallet_balance, 0) > 0
ORDER BY center_name;
