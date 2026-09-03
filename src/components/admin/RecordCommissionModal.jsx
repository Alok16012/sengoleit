import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

const fmt = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function realAdmissionPrice(app) {
  const hasPayment = app.payment_amount != null && Number(app.payment_amount) > 0
  const hasBase = app.base_fee != null && Number(app.base_fee) > 0
  if (hasPayment) return Number(app.payment_amount)
  if (hasBase) return Number(app.base_fee)
  return null
}

export default function RecordCommissionModal({ superCenter, onClose, onSaved }) {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: studs } = await supabase
        .from('students')
        .select(`
          id, student_name, enrollment_no, admission_number, status, fee_collected, centers!inner(id, center_name, center_code, super_center_id, payment_amount, base_fee)
        `)
        .eq('centers.super_center_id', superCenter.id)
        .eq('status', 'Approved')
        .order('created_at', { ascending: false })
        .limit(100)

      setStudents(studs || [])
      setLoading(false)
    }
    load()
  }, [superCenter])

  const filtered = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter(s =>
      (s.student_name || '').toLowerCase().includes(q) ||
      (s.enrollment_no || '').toLowerCase().includes(q) ||
      (s.admission_number || '').toLowerCase().includes(q) ||
      (s.centers?.center_name || '').toLowerCase().includes(q)
    )
  }, [students, search])

  const handleSave = async () => {
    if (!selectedStudent) return

    const app = selectedStudent.centers
    const chargedAmount = realAdmissionPrice(app)
    const baseFee = Number(app.base_fee || 0)

    if (chargedAmount === null) {
      alert('This student has no payment amount or base fee set on the center. Cannot calculate commission.')
      return
    }

    const commission = chargedAmount - baseFee
    if (commission < 0) {
      alert('Commission is negative (charged < base fee). Please check the center fee settings.')
      return
    }

    setSaving(true)
    const patch = {
      super_center_id: superCenter.id,
      center_id: app.id,
      student_id: selectedStudent.id,
      amount: commission,
      base_fee: baseFee,
      charged_amount: chargedAmount,
      kind: 'admission',
      note: note.trim() || null,
    }

    const { error } = await supabase.from('commission_ledger').insert(patch)
    if (error) {
      alert('Failed to record commission: ' + error.message)
      setSaving(false)
      return
    }

    const { data: currentSC } = await supabase
      .from('centers').select('commission_balance').eq('id', superCenter.id).maybeSingle()

    await supabase.from('centers').update({
      commission_balance: (Number(currentSC?.commission_balance || 0) + commission)
    }).eq('id', superCenter.id)

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-lg">Record Commission</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-4 space-y-3 flex-1 overflow-auto">
          <p className="text-sm text-gray-600">
            Super Center: <span className="font-semibold">{superCenter.center_name} ({superCenter.center_code})</span>
            <br />
            <span className="text-xs text-gray-400">
              Commission = Charged Amount − Base Fee (per student)
            </span>
          </p>

          <input
            type="text"
            placeholder="Search by name / enrollment no / admission no / center…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />

          <div className="border rounded divide-y max-h-80 overflow-auto">
            {loading ? (
              <p className="text-center text-gray-400 py-8">Loading students…</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No students found.</p>
            ) : filtered.map(s => {
              const app = s.centers
              const charged = realAdmissionPrice(app)
              const base = Number(app.base_fee || 0)
              const commission = charged !== null ? charged - base : null
              const isSelected = selectedStudent?.id === s.id

              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  className={`w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between gap-3 ${isSelected ? 'bg-blue-100' : ''}`}
                >
                  <div>
                    <p className="font-semibold text-sm">{s.student_name} <span className="text-xs text-gray-400">({s.enrollment_no || s.admission_number})</span></p>
                    <p className="text-xs text-gray-500">
                      {app.center_name} ({app.center_code}) — status: {s.status}
                    </p>
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <p>Charged: <span className="font-semibold">{charged !== null ? fmt(charged) : '-'}</span></p>
                    <p>Base: <span className="font-semibold">{fmt(base)}</span></p>
                    {commission !== null && (
                      <p className={commission >= 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                        Commission: {fmt(commission)}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {selectedStudent && (
            <div className="border rounded p-3 bg-gray-50 space-y-2">
              <p className="text-sm">
                Selected: <span className="font-bold">{selectedStudent.student_name}</span> —
                Charged: <span className="font-bold">{fmt(realAdmissionPrice(selectedStudent.centers))}</span> −
                Base: <span className="font-bold">{fmt(Number(selectedStudent.centers.base_fee || 0))}</span> =
                <span className="font-bold text-green-700"> {fmt(realAdmissionPrice(selectedStudent.centers) - Number(selectedStudent.centers.base_fee || 0))}</span>
              </p>
              <textarea
                placeholder="Note (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                className="border rounded px-3 py-2 w-full text-sm"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!selectedStudent || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 font-semibold"
          >
            {saving ? 'Saving…' : 'Record Commission'}
          </button>
        </div>
      </div>
    </div>
  )
}
