-- student_forward_hold() must lock the student row before it checks it.
--
-- It refused an already-forwarded student, but read the row WITHOUT a lock.
-- Two forward calls arriving together (a double click, two tabs, a retry)
-- both saw forwarded_at empty and both passed that check. Only the wallet
-- row was locked, so they then ran one after the other — and the second went
-- ahead on its stale read: the wallet was charged the hold TWICE, while
-- fee_held was simply SET to the amount both times rather than added to.
-- Approval later converts that single fee_held into fee_collected, so the
-- extra hold vanishes from every record: Used Balance runs ahead of Payment
-- Summary by exactly one hold, with nothing to trace it to.
--
-- student_release_hold() already takes this lock (SELECT ... FOR UPDATE); this
-- gives the forward the same. The second caller now waits, re-reads the row
-- once the first has committed, sees forwarded_at set, and is refused.
--
-- Nothing else in the function changes. Run once in Supabase -> SQL Editor.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION student_forward_hold(
  p_student uuid, p_amount numeric, p_target_center uuid DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s        students%ROWTYPE;
  wallet   uuid;
  bal      numeric;
  amt      numeric := GREATEST(COALESCE(p_amount, 0), 0);
  caller   text := auth.jwt() ->> 'email';
BEGIN
  SELECT * INTO s FROM students WHERE id = p_student FOR UPDATE;   -- <<< the lock
  IF s.id IS NULL THEN RAISE EXCEPTION 'Student not found.'; END IF;
  IF s.forwarded_at IS NOT NULL THEN
    RAISE EXCEPTION 'This student has already been forwarded.';
  END IF;

  -- The wallet charged is the destination centre on a transfer, else the
  -- student's own. Only that centre's own login (or an admin) may do this.
  wallet := COALESCE(p_target_center, s.center_id);
  IF NOT is_admin() AND NOT EXISTS (
    SELECT 1 FROM centers c WHERE c.id = wallet AND c.email = caller
  ) AND NOT EXISTS (
    SELECT 1 FROM centers c WHERE c.id = s.center_id AND c.email = caller
  ) THEN
    RAISE EXCEPTION 'You can only forward your own centre''s students.';
  END IF;

  PERFORM set_config('app.wallet_write', 'on', true);

  IF amt > 0 THEN
    SELECT virtual_balance INTO bal FROM centers WHERE id = wallet FOR UPDATE;
    IF bal IS NULL THEN RAISE EXCEPTION 'Centre wallet not found.'; END IF;
    IF bal < amt THEN
      RAISE EXCEPTION 'Insufficient wallet balance: % available, % needed.', bal, amt;
    END IF;
    UPDATE centers SET virtual_balance = bal - amt WHERE id = wallet;
    bal := bal - amt;
  ELSE
    SELECT virtual_balance INTO bal FROM centers WHERE id = wallet;
  END IF;

  UPDATE students
  SET fee_held    = amt,
      forwarded_at = now(),
      center_id   = COALESCE(p_target_center, center_id)
  WHERE id = p_student;

  RETURN bal;
END $$;

REVOKE ALL ON FUNCTION student_forward_hold(uuid, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION student_forward_hold(uuid, numeric, uuid) TO authenticated;

SELECT 'student_forward_hold now locks the student row' AS result;
