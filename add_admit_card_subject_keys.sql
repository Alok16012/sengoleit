-- Admit cards — remember papers by their identity, not by a row id.
--
-- student_admit_cards.subject_ids holds syllabus_subjects row ids. Saving the
-- syllabus DELETES every row for the course and re-inserts it, so those ids
-- stop matching anything the moment a subject name is corrected. The Exam
-- Section did not notice, because issuing a card prints the rows it has in
-- hand — but the student portal and the centre resolve the card from the
-- stored ids, so their copy came out with no papers on it while the admin's
-- had them all.
--
-- subject_keys stores the same papers as '<code or paper no>|<subject name>',
-- the identity the scheme and the marks already use, which survives a syllabus
-- edit. Readers prefer it and fall back to the ids.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

ALTER TABLE student_admit_cards ADD COLUMN IF NOT EXISTS subject_keys text[];

-- Backfill from the ids that still resolve. A card whose ids have already gone
-- stale cannot be recovered here — it has to be re-issued — and is listed at
-- the end so it is known rather than silently wrong.
UPDATE student_admit_cards ac
SET subject_keys = sub.keys
FROM (
  SELECT ac2.id AS card_id,
         array_agg(
           coalesce(nullif(trim(coalesce(ss.subject_code, '')), ''), trim(coalesce(ss.paper_no, '')))
           || '|' || trim(coalesce(ss.subject_name, ''))
         ) AS keys
  FROM student_admit_cards ac2
  JOIN students st ON st.id = ac2.student_id
  JOIN syllabus_subjects ss
    ON ss.id = ANY (ac2.subject_ids)
   AND ss.program_id = st.programme_id
   AND ss.session_id IS NULL
  WHERE ac2.subject_keys IS NULL
    AND coalesce(array_length(ac2.subject_ids, 1), 0) > 0
  GROUP BY ac2.id
) sub
WHERE ac.id = sub.card_id;

-- Cards that carry papers but could not be resolved — re-issue these from the
-- Exam Section. An empty result means every card carried over.
SELECT st.student_name, ac.semester,
       coalesce(array_length(ac.subject_ids, 1), 0) AS papers_on_card
FROM student_admit_cards ac
JOIN students st ON st.id = ac.student_id
WHERE ac.subject_keys IS NULL
  AND coalesce(array_length(ac.subject_ids, 1), 0) > 0
ORDER BY st.student_name, ac.semester;

SELECT 'student_admit_cards.subject_keys ready' AS result;
