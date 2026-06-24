-- One-time cleanup: keep ONLY Kalawati Computer Center's coupons, delete the rest.
--
-- Why: clear out test/old coupons from every other center so the coupon flow can
-- be re-tested fresh against a single known center.
--
-- Run in Supabase -> SQL Editor. Run STEP 1 first to confirm, then STEP 2.

-- STEP 1 — Preview coupon counts per center (confirm before deleting).
SELECT c.center_name, c.center_code, count(*) AS coupon_count
FROM coupons cp
JOIN centers c ON c.id = cp.center_id
GROUP BY c.center_name, c.center_code
ORDER BY c.center_name;

-- STEP 2 — Delete every coupon EXCEPT those belonging to Kalawati Computer Center.
-- (Also removes orphan coupons that have no center linked.)
DELETE FROM coupons
WHERE center_id IS NULL
   OR center_id NOT IN (
     SELECT id FROM centers WHERE center_name = 'Kalawati Computer Center'
   );

-- STEP 3 — Verify only Kalawati's coupons remain.
SELECT c.center_name, count(*) AS remaining
FROM coupons cp
JOIN centers c ON c.id = cp.center_id
GROUP BY c.center_name;
