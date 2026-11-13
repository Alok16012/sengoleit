-- Coupons go back to Unused when the student who used them is deleted.
--
-- reserve_coupon() never recorded WHICH student used a coupon (its
-- application_id points at centre applications, not students), so deleting
-- the student could not free it. The student row keeps the code it used
-- (students.coupon_code / course_coupon_code) — a trigger frees the coupon
-- carrying that code, at the student's centre, whenever the student is
-- deleted, from any screen and by any login.
--
-- Coupons whose student was deleted BEFORE this ran are not touched here.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

-- Free them when the student goes.
CREATE OR REPLACE FUNCTION release_student_coupons() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE coupons
     SET is_used = false, used_at = NULL
   WHERE coupon_type IN ('discount', 'course')
     AND center_id = OLD.center_id
     AND coupon_code IS NOT NULL
     AND upper(coupon_code) IN (upper(coalesce(OLD.coupon_code, '')), upper(coalesce(OLD.course_coupon_code, '')));
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS students_release_coupons ON students;
CREATE TRIGGER students_release_coupons
  BEFORE DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION release_student_coupons();

-- Account Dept: "Forward to Exam Section" as its own permission, so a role
-- can forward without also approving fees.
INSERT INTO perm_table_access (perm, table_name, access)
VALUES ('account_dept.forward_exam', 'students', 'w')
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';

SELECT 'coupon release on delete ready' AS result;
