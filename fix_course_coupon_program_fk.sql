-- Fix: Students list (and every other screen that reads students with its
-- programme embedded — StudentForm, Account Dept, the forward screen) went
-- blank after add_course_coupon.sql.
--
-- WHY
--   add_course_coupon.sql added students.course_coupon_program_id as a
--   FOREIGN KEY to programs(id) — a second one, alongside the existing
--   students.programme_id -> programs(id). PostgREST embeds a joined table
--   by looking up the relationship BY TABLE NAME ("programs(...)"), and with
--   two foreign keys from students to programs that lookup is ambiguous — it
--   refuses with "more than one relationship was found" instead of guessing,
--   and the whole select (students + their programme) came back as an
--   error, which every one of those screens reads as "no rows" / fails over
--   to an even smaller select, or in the Students list's case, leaves it
--   simply empty.
--
--   course_coupon_program_id only needs to RECORD which course a coupon was
--   for — nothing reads it through a join — so it does not need to be a
--   foreign key at all. Dropping the constraint (keeping the column and its
--   data) removes the ambiguity.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_course_coupon_program_id_fkey;

NOTIFY pgrst, 'reload schema';

SELECT 'course_coupon_program_id is no longer a foreign key — student lists are back' AS result;
