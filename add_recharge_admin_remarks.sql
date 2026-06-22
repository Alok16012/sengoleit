-- Adds an admin remarks column to recharge_requests so the Account
-- Department can record why a recharge was put on hold or rejected.
-- Safe to run multiple times.
ALTER TABLE recharge_requests
  ADD COLUMN IF NOT EXISTS admin_remarks text;
