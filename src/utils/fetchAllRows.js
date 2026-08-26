// PostgREST answers a plain select with at most 1000 rows, silently — no
// error, just a short list. Tables like fee_structures and center_courses have
// grown past that, and the rows that fell off were read as "does not exist":
// a course whose fee structure was older than the newest 1000 showed up as
// "No fee yet", and saving its fee looked like it did nothing.
//
// `build` must return a FRESH query each call (a builder can only be awaited
// once) and must carry a stable order, or a row can repeat or be skipped
// between pages.
//
//   const { data, error } = await fetchAllRows(() =>
//     supabase.from('fee_structures').select('*').order('created_at', { ascending: false }).order('id'))
export async function fetchAllRows(build, { page = 1000 } = {}) {
  const rows = []
  for (let from = 0; ; from += page) {
    const { data, error } = await build().range(from, from + page - 1)
    if (error) return { data: rows, error }
    rows.push(...(data || []))
    if (!data || data.length < page) return { data: rows, error: null }
  }
}
