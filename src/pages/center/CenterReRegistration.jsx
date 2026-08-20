import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Search, RefreshCw, CheckCircle, Clock } from 'lucide-react'
import ReRegistrationModal from '../../components/ReRegistrationModal'
import { fetchReRegistrations, nextTerm } from '../../utils/reRegistration'
import { fetchExamEndDates, examEndDateFor } from '../../utils/examSettings'
import { formatDate } from '../../utils/formatDate'

// Re-Registration for the centre: every enrolled student in one place, with
// the term they are in, the term they can move into, and where their request
// has reached. Raising one used to mean hunting for a single icon on a
// student's row in the Status List — this is the same action, given the screen
// a recurring termly job needs.
//
// The centre only RAISES; the university's Account Dept verifies and takes the
// fee. Nothing here moves money.
const FILTERS = [
  { key: 'due', label: 'Can Re-Register' },
  { key: 'waiting', label: 'Exams Not Over' },
  { key: 'pending', label: 'Awaiting Verification' },
  { key: 'final', label: 'Course Complete' },
  { key: 'all', label: 'All Enrolled' },
]

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function CenterReRegistration() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [reReg, setReReg] = useState({})     // null = migration not run
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('due')
  const [reRegStudent, setReRegStudent] = useState(null)
  const [myCenterId, setMyCenterId] = useState(null)
  // Examination end dates, keyed `${session_id}:${semester}` — the gate that
  // decides when a student turns up as due.
  const [endDates, setEndDates] = useState({})

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('id').eq('email', user.email).single()
      .then(({ data: cd }) => { if (cd) { setMyCenterId(cd.id); fetchStudents(cd.id) } })
  }, [user])

  async function fetchStudents(centerId) {
    setLoading(true)
    // Only enrolled students can re-register — the rest are still in admission.
    const { data: rows } = await supabase
      .from('students')
      .select('id, student_name, enrollment_no, admission_number, mobile_no, gender, status, semester_year, fee_collected, coupon_discount, center_id, programme_id, session_id, programs(program_name, duration, semester_year), academic_sessions(session_name)')
      .eq('center_id', centerId)
      .eq('status', 'Approved')
      .not('is_hidden', 'is', true)
      .order('created_at', { ascending: false })
    setData(rows || [])
    setReReg(await fetchReRegistrations((rows || []).map(s => s.id)))
    setEndDates(await fetchExamEndDates((rows || []).map(s => s.session_id)))
    setLoading(false)
  }

  // A student is "due" whenever they are not waiting on a decision, the course
  // still has a term left, and their current term's exams are over — including
  // one who re-registered last term, since a 4-semester course re-registers
  // three times. Only the final term is an end state.
  //
  // No end date in the Examination Calendar means no signal to wait for, so
  // the student stays available rather than being frozen out by a blank
  // calendar; the row says which it is.
  const stateOf = (s) => {
    if (reReg?.[s.id]?.status === 'Pending') return 'pending'
    if (nextTerm(s).atEnd) return 'final'
    const end = examEndDateFor(s, endDates)
    if (end && new Date(end) > new Date()) return 'waiting'
    return 'due'
  }

  const filtered = data.filter(s => {
    const hay = `${s.student_name} ${s.enrollment_no} ${s.admission_number} ${s.mobile_no}`.toLowerCase()
    if (search && !hay.includes(search.toLowerCase())) return false
    if (filter === 'all') return true
    return stateOf(s) === filter
  })

  const counts = FILTERS.reduce((acc, f) => {
    acc[f.key] = f.key === 'all' ? data.length : data.filter(s => stateOf(s) === f.key).length
    return acc
  }, {})

  return (
    <div className="p-6">
      <PageHeader title="Re-Registration" subtitle="Move an enrolled student into their next semester or year" />

      {reReg === null ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          Re-Registration is not enabled yet. Ask the university to run <code className="font-mono">add_re_registration.sql</code>.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-64 focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
                placeholder="Search students..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    filter === f.key ? 'bg-[#933d18] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#933d18]/40 hover:text-[#933d18]'
                  }`}>
                  {f.label}{counts[f.key] > 0 && <span className={`ml-1.5 ${filter === f.key ? 'text-white/70' : 'text-gray-400'}`}>({counts[f.key]})</span>}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-gray-400 mb-3">
            A student becomes available once their current term's examinations are over. Raise the request here — the university's Account Dept verifies it and collects the fee, and the admit card for that semester opens only after that.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>#</Th>
                  <Th>Student Name</Th>
                  <Th>Enrollment No</Th>
                  <Th>Program</Th>
                  <Th>Session</Th>
                  <Th>Current Term</Th>
                  <Th>Next Term</Th>
                  <Th>Status</Th>
                  <Th>Action</Th>
                </tr>
              </Thead>
              <Tbody>
                {filtered.length === 0 ? (
                  <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">No students here</Td></Tr>
                ) : filtered.map((s, i) => {
                  const t = nextTerm(s)
                  const st = stateOf(s)
                  const req = reReg?.[s.id]
                  return (
                    <Tr key={s.id}>
                      <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                      <Td>
                        <p className="font-semibold text-gray-900">{s.student_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.mobile_no || ''}</p>
                      </Td>
                      <Td className="text-gray-500 font-mono text-xs">{s.enrollment_no || '—'}</Td>
                      <Td className="text-gray-500 text-xs">{s.programs?.program_name || '—'}</Td>
                      <Td className="text-gray-500 text-xs">{s.academic_sessions?.session_name || '—'}</Td>
                      <Td className="text-gray-700 text-xs font-semibold">{t.currentLabel}</Td>
                      <Td className="text-xs font-semibold">
                        {t.atEnd ? <span className="text-gray-300">—</span> : <span className="text-[#933d18]">{t.nextLabel}</span>}
                      </Td>
                      <Td>
                        {st === 'pending' ? (
                          // Say what happened to the money, not just that the
                          // request is waiting: a centre watching its balance
                          // otherwise cannot tell a hold that failed from one
                          // that is not due until the university approves.
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg whitespace-nowrap">
                            <Clock size={11} /> Awaiting verification
                            {req && (req.held_at
                              ? ` · ${money(req.fee_amount)} held`
                              : Number(req.fee_amount) > 0
                                ? ` · ${money(req.fee_amount)} on approval`
                                : ' · nothing to hold')}
                          </span>
                        ) : st === 'final' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg whitespace-nowrap">
                            Final {t.unit.toLowerCase()}
                          </span>
                        ) : st === 'waiting' ? (
                          // Named, so it is obvious this is a date away and not
                          // something the centre has left undone.
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg whitespace-nowrap">
                            <Clock size={11} /> Exams end {formatDate(examEndDateFor(s, endDates))}
                          </span>
                        ) : req?.status === 'Approved' ? (
                          // Context, not a blocker: last term's re-registration
                          // went through; the next one can still be raised.
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg whitespace-nowrap">
                            <CheckCircle size={11} /> {req.to_term} verified{req.decided_at ? ` · ${formatDate(req.decided_at)}` : ''}
                          </span>
                        ) : req?.status === 'Rejected' ? (
                          <span className="text-[10px] font-bold text-red-600">Last request rejected</span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-400">Not requested</span>
                        )}
                      </Td>
                      <Td>
                        {st === 'due' ? (
                          <Button size="sm" variant="primary" onClick={() => setReRegStudent(s)}>
                            <RefreshCw size={13} /> Re-Register
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          )}
        </>
      )}

      {reRegStudent && (
        <ReRegistrationModal
          student={{ ...reRegStudent, center_id: reRegStudent.center_id || myCenterId }}
          mode="request"
          onClose={() => setReRegStudent(null)}
          onDone={() => { setReRegStudent(null); if (myCenterId) fetchStudents(myCenterId) }}
        />
      )}
    </div>
  )
}
