-- ============================================================
-- Duplicate fee deductions
-- ------------------------------------------------------------
-- The Account Dept's "Confirm Approve" button stayed live while the approval
-- ran, and the approval is several statements long. A second click ran the
-- whole thing again against the same stale student object — fee_held still
-- read as it had before — so the shortfall was charged to the centre's wallet
-- twice and student_fee_ledger got two identical Admission lines, while
-- fee_collected was simply overwritten with the same figure and hid it.
--
-- The button is fixed. This finds what the old one left behind.
--
-- READ-ONLY as written. The correction at the bottom is commented out on
-- purpose: refunding money is your call, not a migration's.
-- ============================================================

-- 1. Ledger lines that repeat: same student, same kind, same amount, same day.
SELECT l.student_id,
       s.student_name,
       s.admission_number,
       l.kind,
       l.term,
       l.amount,
       count(*)                    AS times_recorded,
       min(l.created_at)           AS first_recorded,
       max(l.created_at)           AS last_recorded,
       array_agg(l.id ORDER BY l.created_at) AS ledger_ids
FROM student_fee_ledger l
JOIN students s ON s.id = l.student_id
GROUP BY l.student_id, s.student_name, s.admission_number, l.kind, l.term, l.amount,
         date_trunc('day', l.created_at)
HAVING count(*) > 1
ORDER BY max(l.created_at) DESC;

-- 2. For a student from that list: what the ledger says versus what was
--    actually credited. A ledger summing to more than fee_collected is the
--    signature of the double click.
-- SELECT s.id, s.student_name, s.fee_collected,
--        (SELECT sum(amount) FROM student_fee_ledger WHERE student_id = s.id) AS ledger_total
-- FROM students s
-- WHERE s.admission_number = 'ADM-2025-00071';

-- 2b. Was the WALLET charged twice, or only the ledger written twice?
--
--     The wallet only moves at approval by the SHORTFALL, net - fee_held. The
--     hold taken at forward time and the amount required at approval come from
--     the same 50% formula, so normally they match, the shortfall is 0, and a
--     second click charged nothing — it only wrote the second ledger line. The
--     shortfall is non-zero only when the fee due grew between forwarding and
--     approving (another semester's exams finished in between).
--
--     fee_held is cleared at approval, so it cannot be read back. Compare the
--     centre's wallet against what its students account for instead. Treat a
--     small difference as noise: coupons, refunds and manual balance edits all
--     land here too.
-- SELECT c.center_name,
--        c.virtual_balance                                   AS available_now,
--        (SELECT coalesce(sum(r.amount), 0) FROM recharge_requests r
--          WHERE r.center_id = c.id AND r.status = 'verified') AS total_recharged,
--        (SELECT coalesce(sum(st.fee_collected), 0) FROM students st
--          WHERE st.center_id = c.id)                          AS students_account_for
-- FROM centers c
-- WHERE c.id = (SELECT center_id FROM students WHERE admission_number = 'ADM-2025-00071');
--     total_recharged - available_now  should equal  students_account_for.
--     Larger by ~5,375 means the wallet really was hit twice.

-- 3. CORRECTION — read this before running any of it.
--
--    Whether the WALLET moved twice depends on whether the hold already
--    covered the fee at the time. If it did, only the duplicate ledger line
--    exists and there is nothing to refund; if it did not, the centre was
--    charged the shortfall twice and is owed it back. Decide per student from
--    step 2 — do not run this blind.
--
--    a) Drop the duplicate ledger line (keeps the earliest of the pair):
-- DELETE FROM student_fee_ledger WHERE id = '<the later ledger id from step 1>';
--
--    b) Only if the money really left twice, put it back:
-- UPDATE centers SET virtual_balance = virtual_balance + <amount>
--  WHERE id = '<center id>';

-- 4. A guard, so no future click can write the pair again.
--    A student is admitted ONCE, so an admission line is unique per student —
--    the UI fix stops the double click, and this stops anything else that
--    tries. Re-registration and exam-balance lines are left alone: those
--    legitimately repeat, once per term.
--
--    Run step 3a FIRST. While the duplicate is still there the index cannot be
--    built, which is the point — it will not let you skip the cleanup.
CREATE UNIQUE INDEX IF NOT EXISTS student_fee_ledger_one_admission
  ON student_fee_ledger (student_id)
  WHERE kind = 'admission';

SELECT 'duplicate admission lines are now blocked' AS result;
