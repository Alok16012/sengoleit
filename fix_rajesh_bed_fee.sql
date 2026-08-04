-- ============================================================
-- Rajesh Study Center — collect Pascal Mary B's fee properly.
-- Paste the WHOLE file into Supabase -> SQL Editor and run it once.
--
-- WHAT IS WRONG
--   Two separate faults landed on the same student.
--
--   1. The wallet was never debited. fee_collected was written at approval,
--      but the matching debit did not happen — the same silent-failure class
--      fix_wallet_writes.sql closed. So the ₹16,000 recharge is sitting whole
--      in the wallet while the student reads as paid.
--
--   2. The amount recorded is wrong. It says ₹8,750, which is Semester 1 of a
--      DIFFERENT B.Ed fee structure (the one with a ₹23,000 university fee plus
--      entry and per-semester charges). July 2025 B.Ed is a flat ₹32,000 over
--      4 semesters — ₹8,000 a semester, nothing else:
--
--        cumFee(Sem 1) = ₹8,000      cumFee(Sem 2) = ₹16,000
--
--      July 2025 began on 25-07-2025, so two semesters are due, and the fee
--      held at admission is half of that: ₹8,000. The ₹8,750 was almost
--      certainly picked up before the July 2025 structure existed, when the
--      lookup fell back to whichever structure it found first.
--
-- WHAT THIS DOES
--   Sets the student's fee_collected to ₹8,000 and takes ₹8,000 out of the
--   centre's wallet, in one transaction.
--     wallet   ₹16,000 -> ₹8,000
--     student   ₹8,750 -> ₹8,000
--
-- SAFE TO RUN TWICE — it only acts while fee_collected is still 8750, so a
--   second run finds nothing and cannot debit the wallet again.
-- ============================================================

-- BEFORE
SELECT 'BEFORE' AS stage, c.center_name, c.virtual_balance AS wallet,
       s.student_name, s.admission_number, s.fee_collected
FROM students s JOIN centers c ON c.id = s.center_id
WHERE s.admission_number = 'ADM-2025-00023';

BEGIN;

WITH target AS (
  SELECT s.id AS student_id, s.center_id, s.fee_collected AS was
  FROM students s
  WHERE s.admission_number = 'ADM-2025-00023'
    AND s.fee_collected = 8750          -- guard: only the wrong figure
),
paid AS (
  UPDATE students SET fee_collected = 8000
  WHERE id IN (SELECT student_id FROM target)
  RETURNING center_id
)
UPDATE centers
SET virtual_balance = COALESCE(virtual_balance, 0) - 8000
WHERE id IN (SELECT center_id FROM paid);

COMMIT;

-- AFTER — wallet ₹8,000, student ₹8,000
SELECT 'AFTER' AS stage, c.center_name, c.virtual_balance AS wallet,
       s.student_name, s.admission_number, s.fee_collected
FROM students s JOIN centers c ON c.id = s.center_id
WHERE s.admission_number = 'ADM-2025-00023';
