-- Records how much was deducted from the center's wallet for each student at the
-- moment the Account Department approves/enrolls them. Powers the Payment Summary
-- report (per-student fee collection).
--
-- Run this once in Supabase → SQL Editor.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS fee_collected numeric;

-- fee_collected = course fee for the admitted semester/year, less any reserved
-- coupon discount, charged from the center wallet on approval.
-- NULL  => student not yet approved, or approved before this column existed.
