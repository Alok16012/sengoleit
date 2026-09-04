// A fee line that actually charges something.
//
// The editor keeps every line the user has typed, zeros included — that is
// where a fee is drafted, and a component sitting at 0 is how "this course does
// not take a Form Fee" is entered. But a zero does not belong on the STRUCTURE
// TABLE, the View modal, or the PDF a centre downloads: a page of dashes reads
// as if the fee sheet is half-filled rather than as a deliberate nil.
//
// One definition, used by all four renderers, so the printed sheet and the
// screen can never disagree about which lines exist.
//
// Dropping a ZERO line never moves a total — it contributes 0 to the entry,
// per-semester and grand totals alike, which is why the PDF and the centre's
// view can filter at the source and still add up.
//
// Dropping an UNLABELLED line could move a total, but only in an unsaved
// draft: handleSave already writes `items.filter(i => i.label.trim())`, so a
// blank label with an amount never reaches the database. The editor's table
// filtered on label before this existed, so nothing changes there either.
export const isCharged = (i) =>
  String(i?.label || '').trim() !== '' && (parseFloat(i?.amount) || 0) > 0
