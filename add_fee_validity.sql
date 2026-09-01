-- Fee validity window — "this fee applies from this date to that date".
--
-- Why: when a fee is revised, the OLD fee must stop being offered. Without an
-- end date the only options were to delete the old structure (losing what
-- existing students were admitted under) or to overwrite it (same loss). A
-- validity window lets the old fee simply lapse: it stays on record, stops
-- being offered to centres, and a new fee takes over.
--
-- Semantics — NULL means "no limit", so every fee that exists today keeps
-- working exactly as it does now:
--   valid_from NULL → valid since forever
--   valid_to   NULL → valid until further notice
-- A structure is OFFERABLE today when
--   (valid_from IS NULL OR valid_from <= current_date)
--   AND (valid_to IS NULL OR valid_to >= current_date)
--
-- This gates what a CENTRE may offer and admit into. It deliberately does NOT
-- gate an existing student's fee: a student admitted under last year's fee is
-- still billed under it after it lapses.
--
-- Run in Supabase -> SQL Editor. Safe to re-run.

ALTER TABLE fee_structures
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_to   date;

COMMENT ON COLUMN fee_structures.valid_from IS
  'First date this fee may be offered. NULL = no start limit.';
COMMENT ON COLUMN fee_structures.valid_to IS
  'Last date this fee may be offered. NULL = no end limit. Past this date the course stops appearing for centres (course list + admission form); already-admitted students are unaffected.';

-- Centre-facing reads filter on the window, so index it.
CREATE INDEX IF NOT EXISTS fee_structures_validity_idx
  ON fee_structures (valid_to, valid_from);

-- A window that ends before it starts can never be offered, and is always a
-- typo rather than an intent.
ALTER TABLE fee_structures DROP CONSTRAINT IF EXISTS fee_structures_validity_order;
ALTER TABLE fee_structures ADD CONSTRAINT fee_structures_validity_order
  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to);

SELECT 'fee validity ready' AS result,
       count(*) FILTER (WHERE valid_to IS NOT NULL) AS with_end_date,
       count(*) AS total
FROM fee_structures;
