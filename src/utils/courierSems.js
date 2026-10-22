import { supabase } from '../lib/supabase'
import { fetchAllRows } from './fetchAllRows'

// "Sem 1, 2, 3"
export const semText = sems => (sems || []).length ? `Sem ${[...sems].sort((a, b) => a - b).join(', ')}` : ''

// A student's document type(s) for one courier, e.g. "Marksheet, Provisional"
// or "Other: Bonafide Certificate".
export const docLabel = st => (st?.document_types || [])
  .map(t => t === 'Other' && st.other_document ? `Other: ${st.other_document}` : t).join(', ')

// Which documents each student has been couriered, read from the Courier
// Details log: { studentId: { sems: [1, 2], docTypes: Set('Marksheet', 'Provisional'),
// couriers: [{ date, tracking_no, docs, sems }] } }.
// null when add_courier_details.sql / add_courier_students.sql has not been run.
export async function fetchCourierSems() {
  const { data, error } = await fetchAllRows(() => supabase.from('courier_details')
    .select('id, courier_date, tracking_no, document_types, other_document, students')
    .order('courier_date', { ascending: true }).order('id'))
  if (error) return null
  const map = {}
  for (const c of data) {
    for (const st of Array.isArray(c.students) ? c.students : []) {
      // Old rows recorded semesters with no per-student document_types —
      // read as "Marksheet", what the field meant before types went per
      // student. Current rows fall back to the courier's own types.
      const types = st.document_types?.length ? st.document_types
        : (st.semesters?.length ? ['Marksheet'] : (c.document_types || []))
      const docs = types.map(t => t === 'Other' && (st.other_document || c.other_document)
        ? `Other: ${st.other_document || c.other_document}` : t).join(', ')
      const e = map[st.id] || (map[st.id] = { sems: [], docTypes: new Set(), couriers: [] })
      e.sems = [...new Set([...e.sems, ...(st.semesters || [])])].sort((a, b) => a - b)
      types.forEach(t => e.docTypes.add(t))
      e.couriers.push({ date: c.courier_date, tracking_no: c.tracking_no, docs, sems: st.semesters || [] })
    }
  }
  return map
}

// Students of a courier matching a search (name / enrollment no).
export function studentHits(courier, q) {
  const t = String(q || '').trim().toLowerCase()
  if (!t) return []
  return (courier.students || []).filter(st => `${st.name || ''} ${st.enrollment_no || ''}`.toLowerCase().includes(t))
}
