-- Approval Code requests: a center / super center requests an approval-code
-- amount (with payment proof). The Account Dept verifies it and, on Verify,
-- credits the amount into the center's coupon wallet so approval codes can be
-- minted in Coupon Management.
-- Run in Supabase -> SQL Editor.

CREATE TABLE IF NOT EXISTS approval_code_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid REFERENCES centers(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  utr_number text,
  payment_date date,
  utr_screenshot_url text,
  notes text,
  status text NOT NULL DEFAULT 'pending',  -- pending | verified | rejected
  admin_remarks text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approval_code_requests_center_idx ON approval_code_requests(center_id);
CREATE INDEX IF NOT EXISTS approval_code_requests_status_idx ON approval_code_requests(status);

SELECT 'approval_code_requests table ready' AS result;
