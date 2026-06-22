-- The recharge_requests.status CHECK constraint originally allowed only
-- 'pending', 'verified' and 'rejected'. The Account Department can now also
-- put a recharge On Hold, so we widen the constraint to include 'hold'.
-- Safe to run multiple times.

ALTER TABLE recharge_requests
  DROP CONSTRAINT IF EXISTS recharge_requests_status_check;

ALTER TABLE recharge_requests
  ADD CONSTRAINT recharge_requests_status_check
  CHECK (status IN ('pending', 'verified', 'rejected', 'hold'));
