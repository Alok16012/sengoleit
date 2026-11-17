-- Research Dept -> Master Panel: a second number series per document, for
-- the ones that carry two numbers (Provisional Certificate: Registration No
-- and S.no; Title of Thesis: Provisional Registration No and S.no).
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

ALTER TABLE letter_settings ADD COLUMN IF NOT EXISTS prefix_2   text;
ALTER TABLE letter_settings ADD COLUMN IF NOT EXISTS next_num_2 int DEFAULT 1;

NOTIFY pgrst, 'reload schema';

SELECT 'letter second series ready' AS result;
