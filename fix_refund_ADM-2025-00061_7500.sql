-- Ph.D candidate Satarupa Chakrabarti (Application No. ADM-2025-00061):
-- Rs 67,500 was taken, Rs 60,000 was due. This sets the fee paid to Rs 60,000
-- and returns the Rs 7,500 to her centre's wallet, with a line in the
-- Payment Summary so the refund is on record.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run: it only acts while the
-- fee paid is exactly Rs 67,500, so a second run changes nothing.
-- The result shows what was done, or why nothing was.

WITH s AS (
  SELECT id, center_id, student_name, fee_collected
    FROM students
   WHERE admission_number = 'ADM-2025-00061'
),
fix AS (
  UPDATE students st
     SET fee_collected = 60000
    FROM s
   WHERE st.id = s.id AND s.fee_collected = 67500 AND s.center_id IS NOT NULL
  RETURNING st.id, st.center_id
),
wallet AS (
  UPDATE centers c
     SET virtual_balance = c.virtual_balance + 7500
    FROM fix
   WHERE c.id = fix.center_id
  RETURNING c.center_name, c.virtual_balance
),
ledger AS (
  INSERT INTO student_fee_ledger (student_id, center_id, amount, kind, term, note)
  SELECT fix.id, fix.center_id, -7500, 'research_refund', 'Registration Certificate',
         'Rs 7,500 taken in excess (67,500 instead of 60,000) returned to the centre wallet'
    FROM fix
  RETURNING id
)
SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM s) THEN 'Nothing done: Application No. ADM-2025-00061 not found'
    WHEN NOT EXISTS (SELECT 1 FROM fix) THEN 'Nothing done: fee paid is not 67,500 (already corrected?)'
    ELSE 'Done: fee paid set to 60,000 and 7,500 returned to the wallet'
  END                                              AS result,
  (SELECT student_name FROM s)                     AS student,
  (SELECT fee_collected FROM s)                    AS fee_paid_before,
  (SELECT center_name FROM wallet)                 AS centre,
  (SELECT virtual_balance FROM wallet)             AS wallet_balance_now,
  (SELECT count(*) FROM ledger)                    AS refund_lines_added;
