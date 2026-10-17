import { supabase } from '../lib/supabase'
import { fetchAllRows } from './fetchAllRows'

// Which semesters' documents each student has been couriered, read from the
// Courier Details log: { studentId: { sems: [1, 2], couriers: [{ date, tracking_no, docs, sems }] } }.
// null when add_courier_details.sql / add_courier_students.sql has not been run.
export async function fetchCourierSems() {
  const { data, error } = await fetchAllRows(() => supabase.from('courier_details')
    .select('id, courier_date, tracking_no, document_types, other_document, students')
    .order('courier_date', { ascending: true }).order('id'))
  if (error) return null
  const map = {}
  for (const c of data) {
    const docs = (c.document_types || []).map(t => t === 'Other' && c.other_document ? c.other_document : t).join(', ')
    for (const st of Array.isArray(c.students) ? c.students : []) {
      const e = map[st.id] || (map[st.id] = { sems: [], couriers: [] })
      e.sems = [...new Set([...e.sems, ...(st.semesters || [])])].sort((a, b) => a - b)
      e.couriers.push({ date: c.courier_date, tracking_no: c.tracking_no, docs, sems: st.semesters || [] })
    }
  }
  return map
}
