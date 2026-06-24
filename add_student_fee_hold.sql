-- Wallet "hold" mechanism for student admissions.
--
-- Flow:
--   1. Center submits a student  -> status='Pending', forwarded_at=NULL (50% of
--      the fee only needs to be AVAILABLE in the wallet; nothing is charged).
--   2. Center forwards from the Pending list -> forwarded_at is set, the full
--      net fee is moved into HOLD: it is deducted from centers.virtual_balance
--      and recorded in students.fee_held. The student now reaches the Doc Dept.
--   3. Doc Dept / Account Dept reject -> the held amount is refunded back to
--      virtual_balance and fee_held is cleared (un-hold).
--   4. Account Dept approve/enroll -> the held amount becomes the collected fee
--      (fee_collected = fee_held), fee_held is cleared. No second deduction —
--      the money already left the wallet at forward time.
--
-- Run this once in Supabase -> SQL Editor.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS fee_held numeric,         -- amount currently locked in the wallet for this student
  ADD COLUMN IF NOT EXISTS forwarded_at timestamptz; -- when the center forwarded it to the Document Dept

-- fee_held  > 0    => money is held in the center wallet for this application
-- fee_held  = 0/NULL => nothing held (not forwarded, refunded, or already collected)
-- forwarded_at NULL  => still sitting in the center's Pending list, not yet forwarded
