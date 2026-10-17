import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import { SearchableSelect } from '../../components/ui/SearchSelect'
import { CourierStudentsCell, CourierStudentsModal } from '../../components/CourierStudents'
import { Truck, Search, Paperclip } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

// The couriers the university has sent — read-only. A centre sees the ones
// entered against it; a super centre sees its own and its centres'. The rows
// come from the admin's Courier Details; which ones a portal may read is set by
// add_courier_center_read.sql.
export default function CourierView() {
  const { user, profile } = useAuth()
  const role = profile?.role || user?.user_metadata?.role || 'center'
  const [rows, setRows] = useState([])
  const [centers, setCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [centerFilter, setCenterFilter] = useState('all')
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    if (!user?.email) return
    async function load() {
      const { data: me } = await supabase.from('centers').select('id, center_name, center_code')
        .eq('email', user.email).maybeSingle()
      if (!me) { setLoading(false); return }
      let mine = [me]
      if (role === 'super_center') {
        const { data: subs } = await supabase.from('centers').select('id, center_name, center_code')
          .eq('super_center_id', me.id).order('center_name')
        mine = [me, ...(subs || [])]
      }
      const ids = mine.map(c => c.id)
      const { data } = await supabase.from('courier_details').select('*')
        .or(`center_id.in.(${ids.join(',')}),super_center_id.in.(${ids.join(',')})`)
        .order('courier_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
      setCenters(mine)
      setRows(data || [])
      setLoading(false)
    }
    load()
  }, [user?.email, role])

  const centerById = useMemo(() => Object.fromEntries(centers.map(c => [c.id, c])), [centers])
  const docText = r => (r.document_types || []).map(t => t === 'Other' && r.other_document ? `Other: ${r.other_document}` : t).join(', ')

  const filtered = rows.filter(r => {
    if (centerFilter !== 'all' && r.center_id !== centerFilter) return false
    if (!q.trim()) return true
    const hay = [
      centerById[r.center_id]?.center_name, docText(r), r.student_name,
      (r.students || []).map(st => `${st.name} ${st.enrollment_no}`).join(' '),
      r.tracking_no, r.sent_to_address, r.sent_from, r.sender_by,
    ].join(' ').toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  const showCenter = role === 'super_center'

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Courier Details" subtitle="Documents the university has couriered to you" />

      <div className="flex items-end justify-between gap-3 flex-wrap">
        {showCenter ? (
          <SearchableSelect label="Center" allLabel="All Centers" value={centerFilter} onChange={setCenterFilter}
            options={centers.map(c => ({ id: c.id, label: `${c.center_name}${c.center_code ? ` (${c.center_code})` : ''}` }))} minWidth={240} />
        ) : <span />}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search student / tracking no…"
            className="pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-72" />
        </div>
      </div>

      <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
        <Truck size={16} className="text-[#933d18]" /> Couriers ({filtered.length})
      </p>

      <Table>
        <Thead>
          <Tr>
            <Th>#</Th>{showCenter && <Th>Center</Th>}<Th>Documents</Th><Th>Date</Th><Th>Student Name</Th>
            <Th>Tracking No</Th><Th>Sent To Address</Th><Th>From</Th><Th>Sender By</Th><Th>Receipts</Th>
          </Tr>
        </Thead>
        <Tbody>
          {loading ? (
            <Tr><Td colSpan={10} className="text-center text-gray-400 py-8">Loading...</Td></Tr>
          ) : filtered.length === 0 ? (
            <Tr><Td colSpan={10} className="text-center text-gray-400 py-8">No couriers yet.</Td></Tr>
          ) : filtered.map((r, i) => (
            <Tr key={r.id}>
              <Td>{i + 1}</Td>
              {showCenter && <Td className="text-sm">{centerById[r.center_id]?.center_name || centerById[r.super_center_id]?.center_name || '—'}</Td>}
              <Td className="text-sm">{docText(r) || '—'}</Td>
              <Td className="text-sm whitespace-nowrap">{formatDate(r.courier_date)}</Td>
              <Td className="text-sm min-w-[200px]"><CourierStudentsCell courier={r} q={q} onView={setViewing} /></Td>
              <Td className="text-sm font-mono">{r.tracking_no || '—'}</Td>
              <Td className="text-sm max-w-[220px] whitespace-pre-line">{r.sent_to_address || '—'}</Td>
              <Td className="text-sm">{r.sent_from || '—'}</Td>
              <Td className="text-sm">{r.sender_by || '—'}</Td>
              <Td>
                <div className="flex flex-col gap-1">
                  {(r.receipts || []).length === 0 ? <span className="text-gray-400 text-sm">—</span> :
                    r.receipts.map((f, k) => (
                      <a key={k} href={f.url} target="_blank" rel="noreferrer"
                        className="text-xs text-[#933d18] hover:underline flex items-center gap-1 whitespace-nowrap">
                        <Paperclip size={12} /> Receipt {k + 1}
                      </a>
                    ))}
                </div>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <CourierStudentsModal courier={viewing} centerName={centerById[viewing?.center_id]?.center_name}
        q={q} onClose={() => setViewing(null)} />
    </div>
  )
}
