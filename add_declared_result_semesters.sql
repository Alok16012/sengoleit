-- ============================================================
-- Re-Registration opens when a result is DECLARED, not when it is released
-- ------------------------------------------------------------
-- Declaring a result and showing it to the student are two separate steps:
-- the Exam Section declares it, then Activate releases it. Only the second is
-- about the student seeing marks; the first is what says the semester is over.
--
-- Re-Registration was gated on the wrong one. The centre reads results through
-- portal_results, which for a centre returns only rows with released_at set —
-- so a declared-but-deactivated result looked to the centre exactly like no
-- result at all, and reRegBlocker held the student back. Activate opened
-- Re-Registration, Deactivate closed it again, which was never the intent.
--
-- Simply dropping that filter would hand the centre the marks early, and the
-- whole point of Activate is choosing when they are shown. So this is a second,
-- deliberately thin function: which semesters have a declared result, and
-- nothing else. No marks, no marksheet, no remarks. Enough to open
-- Re-Registration, useless for reading a result.
--
-- portal_results is left exactly as it is — result VIEWING still waits for
-- Activate everywhere.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run. Stands alone: the centre
-- lookup is inlined rather than calling portal_center_ids(), which lives in
-- fix_center_portal_reads.sql and is not present on every database. A plpgsql
-- body is not checked for missing functions when it is created, so depending on
-- it would have compiled fine here and then failed at runtime for every centre
-- — the gate would have silently stayed exactly as it was.
-- ============================================================

CREATE OR REPLACE FUNCTION portal_declared_semesters(p_students uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ids uuid[]; payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF p_students IS NULL OR coalesce(array_length(p_students, 1), 0) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  -- 'Pending' is the Exam Section's own not-yet-declared marker, the same test
  -- it uses to decide whether a semester's result is done.
  IF is_admin() THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'student_id', r.student_id, 'semester', r.semester, 'status', r.status
           ) ORDER BY r.student_id, r.semester), '[]'::jsonb)
      INTO payload
    FROM student_results r
    WHERE r.student_id = ANY (p_students)
      AND r.status <> 'Pending';
    RETURN payload;
  END IF;

  -- The centres the caller speaks for: its own, plus every sub-centre when the
  -- caller is a super centre. Same rule as portal_center_ids(), inlined so this
  -- file does not depend on that one having been run.
  SELECT coalesce(array_agg(DISTINCT t.id), '{}'::uuid[]) INTO ids
  FROM (
    SELECT c.id FROM centers c
     WHERE c.email = (auth.jwt() ->> 'email')
    UNION
    SELECT child.id FROM centers child
      JOIN centers parent ON parent.id = child.super_center_id
     WHERE parent.email = (auth.jwt() ->> 'email')
  ) t;
  IF coalesce(array_length(ids, 1), 0) = 0 THEN RETURN '[]'::jsonb; END IF;

  -- No released_at condition on purpose: a declared result opens
  -- Re-Registration whether or not the admin has shown it yet.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'student_id', r.student_id, 'semester', r.semester, 'status', r.status
         ) ORDER BY r.student_id, r.semester), '[]'::jsonb)
    INTO payload
  FROM student_results r
  JOIN students s ON s.id = r.student_id
  WHERE r.student_id = ANY (p_students)
    AND s.center_id = ANY (ids)
    AND r.status <> 'Pending';
  RETURN payload;
END $$;

REVOKE ALL ON FUNCTION portal_declared_semesters(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal_declared_semesters(uuid[]) TO authenticated;

SELECT 'portal_declared_semesters ready' AS result;
