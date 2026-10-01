-- Document-wise print records for the Exam Section's Print tab.
--
-- WHY
--   The Print tab used to know one thing per result: student_results.printed_at,
--   stamped the first time a semester's marksheet went to the printer. Nothing
--   recorded the Provisional, Migration or Degree certificates, how many times a
--   document had been printed, or who printed it — so a reprint looked exactly
--   like a first print and there was no history to check one against.
--
--   Every printable document now has a row of its own here:
--     print_documents — one row per student per document (per semester for a
--                       marksheet): how many times it has been printed, when
--                       first, when last reprinted, and by whom.
--     print_history   — one row per print, FIRST_PRINT or REPRINT, never edited.
--
--   Both are written ONLY through record_document_prints(), which the print
--   window calls after the operator confirms the sheets actually printed — a
--   cancelled or failed print never reaches the table.
--
--   Existing printed marksheets (printed_at set) are carried over as printed
--   once, so nothing already printed goes back to Pending.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- (add_result_print_flow.sql and add_result_printed_at.sql must have been run.)
-- ============================================================

CREATE TABLE IF NOT EXISTS print_documents (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id             uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  doc_type               text NOT NULL
                         CHECK (doc_type IN ('MARKSHEET','PROVISIONAL','MIGRATION','DEGREE','CONSOLIDATED')),
  semester               int  NOT NULL DEFAULT 0,   -- 0 for the final documents
  result_id              uuid,                       -- the marksheet's student_results row
  print_count            int  NOT NULL DEFAULT 0,
  first_printed_at       timestamptz,
  first_printed_by       text,
  last_printed_at        timestamptz,
  last_reprinted_at      timestamptz,
  last_reprinted_by      text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, doc_type, semester)
);

CREATE TABLE IF NOT EXISTS print_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES print_documents(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  doc_type     text NOT NULL,
  semester     int  NOT NULL DEFAULT 0,
  action       text NOT NULL CHECK (action IN ('FIRST_PRINT','REPRINT')),
  print_number int  NOT NULL,          -- 1 for the first print, 2 for the first reprint …
  printed_by   text,
  printed_at   timestamptz NOT NULL DEFAULT now(),
  job_id       uuid                    -- prints confirmed together share one
);

CREATE INDEX IF NOT EXISTS print_history_student_idx ON print_history (student_id, printed_at);
CREATE INDEX IF NOT EXISTS print_documents_student_idx ON print_documents (student_id);

-- Read by the admin; written only by the function below.
ALTER TABLE print_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_history   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS print_documents_admin_read ON print_documents;
CREATE POLICY print_documents_admin_read ON print_documents FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS print_history_admin_read ON print_history;
CREATE POLICY print_history_admin_read ON print_history FOR SELECT USING (is_admin());

-- ------------------------------------------------------------
-- Record documents that have just been printed.
--
-- p_items: [{ "student_id": "...", "doc_type": "MARKSHEET", "semester": 2 }, …]
--
-- Each document's count goes up by one: the first print of a document is a
-- FIRST_PRINT, every one after it a REPRINT. A marksheet must have been sent
-- to Print; a final document must be due — every semester of the course
-- declared, none failed, each marksheet printed. All or nothing: if any item
-- is refused, none is recorded.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_document_prints(p_items jsonb, p_job uuid DEFAULT NULL)
RETURNS TABLE (student_id uuid, doc_type text, semester int, print_count int,
               first_printed_at timestamptz, first_printed_by text,
               last_printed_at timestamptz, last_reprinted_at timestamptz, last_reprinted_by text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it      jsonb;
  v_sid   uuid;
  v_type  text;
  v_sem   int;
  v_res   uuid;
  v_fwd   timestamptz;
  v_total int;
  v_bad   text;
  v_by    text := COALESCE(NULLIF(auth.jwt() ->> 'email', ''), auth.uid()::text, 'admin');
  v_now   timestamptz := now();
  d       print_documents%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can record printed documents.';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Nothing to record.';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_sid  := (it ->> 'student_id')::uuid;
    v_type := upper(COALESCE(it ->> 'doc_type', ''));
    v_sem  := COALESCE((it ->> 'semester')::int, 0);

    IF v_type NOT IN ('MARKSHEET','PROVISIONAL','MIGRATION','DEGREE','CONSOLIDATED') THEN
      RAISE EXCEPTION 'Unknown document type: %', v_type;
    END IF;

    -- One document at a time, so two confirmations of the same sheet count twice
    -- rather than racing to the same number.
    PERFORM pg_advisory_xact_lock(hashtext('print:' || v_sid || ':' || v_type || ':' || v_sem));

    v_res := NULL; v_fwd := NULL;
    IF v_type = 'MARKSHEET' THEN
      SELECT r.id, r.print_forwarded_at INTO v_res, v_fwd FROM student_results r
       WHERE r.student_id = v_sid AND r.semester = v_sem;
      IF v_res IS NULL OR v_fwd IS NULL THEN
        RAISE EXCEPTION 'Semester % of this student has not been sent to Print.', v_sem;
      END IF;
    ELSE
      v_sem := 0;
      -- A final document that has been printed before may always be reprinted;
      -- the first print has to be due.
      IF v_type <> 'CONSOLIDATED' AND NOT EXISTS (
        SELECT 1 FROM print_documents p
         WHERE p.student_id = v_sid AND p.doc_type = v_type AND p.semester = 0 AND p.print_count > 0
      ) THEN
        SELECT pr.duration INTO v_total
          FROM students s JOIN programs pr ON pr.id = s.programme_id
         WHERE s.id = v_sid;
        IF COALESCE(v_total, 0) < 1 THEN
          RAISE EXCEPTION 'The course duration is not set, so the final documents are not due.';
        END IF;
        SELECT string_agg('Semester ' || g.n, ', ' ORDER BY g.n) INTO v_bad
          FROM generate_series(1, v_total) AS g(n)
         WHERE NOT EXISTS (
           SELECT 1 FROM student_results r
             JOIN print_documents p ON p.student_id = r.student_id AND p.doc_type = 'MARKSHEET'
                                   AND p.semester = r.semester AND p.print_count > 0
            WHERE r.student_id = v_sid AND r.semester = g.n
              AND r.declared_at IS NOT NULL
              AND COALESCE(r.status, 'Pending') NOT IN ('Pending', 'Fail')
              AND r.print_forwarded_at IS NOT NULL);
        IF v_bad IS NOT NULL THEN
          RAISE EXCEPTION 'The % is not due yet — % not passed, sent to Print and printed.', initcap(v_type), v_bad;
        END IF;
      END IF;
    END IF;

    INSERT INTO print_documents AS p (student_id, doc_type, semester, result_id, print_count,
                                      first_printed_at, first_printed_by, last_printed_at)
    VALUES (v_sid, v_type, v_sem, v_res, 1, v_now, v_by, v_now)
    ON CONFLICT ON CONSTRAINT print_documents_student_id_doc_type_semester_key DO UPDATE
       SET print_count       = p.print_count + 1,
           result_id         = COALESCE(EXCLUDED.result_id, p.result_id),
           first_printed_at  = COALESCE(p.first_printed_at, EXCLUDED.first_printed_at),
           first_printed_by  = COALESCE(p.first_printed_by, EXCLUDED.first_printed_by),
           last_printed_at   = v_now,
           last_reprinted_at = CASE WHEN p.print_count >= 1 THEN v_now ELSE p.last_reprinted_at END,
           last_reprinted_by = CASE WHEN p.print_count >= 1 THEN v_by  ELSE p.last_reprinted_by END,
           updated_at        = v_now
    RETURNING p.* INTO d;

    INSERT INTO print_history (document_id, student_id, doc_type, semester, action, print_number, printed_by, printed_at, job_id)
    VALUES (d.id, v_sid, v_type, v_sem,
            CASE WHEN d.print_count = 1 THEN 'FIRST_PRINT' ELSE 'REPRINT' END,
            d.print_count, v_by, v_now, p_job);

    -- The Result section and the student portal still read printed_at.
    IF v_type = 'MARKSHEET' THEN
      UPDATE student_results r SET printed_at = COALESCE(r.printed_at, v_now) WHERE r.id = v_res;
    END IF;

    student_id := d.student_id; doc_type := d.doc_type; semester := d.semester;
    print_count := d.print_count;
    first_printed_at := d.first_printed_at; first_printed_by := d.first_printed_by;
    last_printed_at := d.last_printed_at;
    last_reprinted_at := d.last_reprinted_at; last_reprinted_by := d.last_reprinted_by;
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION record_document_prints(jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_document_prints(jsonb, uuid) TO authenticated;

-- ------------------------------------------------------------
-- Carry over marksheets printed before this existed: printed once, on the
-- day printed_at says. Only rows not already recorded, so a re-run adds
-- nothing twice.
-- ------------------------------------------------------------
WITH carried AS (
  INSERT INTO print_documents (student_id, doc_type, semester, result_id, print_count,
                               first_printed_at, first_printed_by, last_printed_at)
  SELECT DISTINCT ON (r.student_id, r.semester)
         r.student_id, 'MARKSHEET', r.semester, r.id, 1, r.printed_at, 'Before print tracking', r.printed_at
    FROM student_results r
   WHERE r.printed_at IS NOT NULL AND r.semester IS NOT NULL
   ORDER BY r.student_id, r.semester, r.printed_at
  ON CONFLICT (student_id, doc_type, semester) DO NOTHING
  RETURNING id, student_id, semester, first_printed_at
)
INSERT INTO print_history (document_id, student_id, doc_type, semester, action, print_number, printed_by, printed_at)
SELECT id, student_id, 'MARKSHEET', semester, 'FIRST_PRINT', 1, 'Before print tracking', first_printed_at
  FROM carried;

SELECT (SELECT count(*) FROM print_documents) AS documents_recorded,
       (SELECT count(*) FROM print_history)   AS history_rows;
