import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Plus, Trash2, Save, IndianRupee, GraduationCap } from 'lucide-react'

const DEFAULT_ENTRY = [
  { label: 'University Fee',      category: 'entry',    amount: 0 },
  { label: 'Prospectus Fee',      category: 'entry',    amount: 0 },
  { label: 'Enrollment Fee',      category: 'entry',    amount: 0 },
  { label: 'Exam Fee',            category: 'entry',    amount: 0 },
  { label: 'Re-Registration Fee', category: 'entry',    amount: 0 },
]

const DEFAULT_SEM = [
  { label: 'Form Fee',            category: 'semester', amount: 0 },
  { label: 'University Fee',      category: 'semester', amount: 0 },
  { label: 'Exam Fee',            category: 'semester', amount: 0 },
]

let _key = 0
function newKey() { return ++_key }
function withKeys(items) { return items.map(i => ({ ...i, _key: newKey() })) }

export default function FeeManagement() {
  const [programs, setPrograms]             = useState([])
  const [sessions, setSessions]             = useState([])
  const [selectedProgram, setSelectedProgram] = useState('')
  const [selectedSession, setSelectedSession] = useState('')
  const [totalSemesters, setTotalSemesters] = useState(4)
  const [structureId, setStructureId]       = useState(null)
  const [items, setItems]                   = useState([])
  const [loading, setLoading]               = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)

  useEffect(() => {
    supabase.from('programs').select('id, program_name').order('program_name')
      .then(({ data }) => setPrograms(data || []))
    supabase.from('academic_sessions').select('id, session_name').order('session_name', { ascending: false })
      .then(({ data }) => setSessions(data || []))
  }, [])

  useEffect(() => {
    if (!selectedProgram) { setItems([]); setStructureId(null); return }
    loadStructure()
  }, [selectedProgram, selectedSession])

  async function loadStructure() {
    setLoading(true)
    let q = supabase
      .from('fee_structures')
      .select('*, fee_items(id, label, category, amount, sort_order)')
      .eq('program_id', selectedProgram)
    q = selectedSession ? q.eq('session_id', selectedSession) : q.is('session_id', null)
    const { data } = await q.maybeSingle()

    if (data) {
      setStructureId(data.id)
      setTotalSemesters(data.total_semesters || 4)
      const sorted = [...(data.fee_items || [])].sort((a, b) => a.sort_order - b.sort_order)
      setItems(sorted.map(i => ({ ...i, _key: newKey() })))
    } else {
      setStructureId(null)
      setTotalSemesters(4)
      setItems(withKeys([...DEFAULT_ENTRY, ...DEFAULT_SEM]))
    }
    setLoading(false)
  }

  function addItem(category) {
    setItems(prev => [...prev, { label: '', category, amount: 0, _key: newKey() }])
  }

  function update(key, field, value) {
    setItems(prev => prev.map(i => i._key === key ? { ...i, [field]: value } : i))
  }

  function remove(key) {
    setItems(prev => prev.filter(i => i._key !== key))
  }

  async function handleSave() {
    if (!selectedProgram) return
    setSaving(true)
    setSaved(false)

    let sid = structureId
    if (!sid) {
      const { data } = await supabase.from('fee_structures').insert({
        program_id: selectedProgram,
        session_id: selectedSession || null,
        total_semesters: totalSemesters,
      }).select('id').single()
      sid = data?.id
    } else {
      await supabase.from('fee_structures').update({
        session_id: selectedSession || null,
        total_semesters: totalSemesters,
      }).eq('id', sid)
    }

    if (!sid) { setSaving(false); return }

    await supabase.from('fee_items').delete().eq('fee_structure_id', sid)

    const validItems = items.filter(i => i.label.trim())
    if (validItems.length > 0) {
      await supabase.from('fee_items').insert(
        validItems.map((i, idx) => ({
          fee_structure_id: sid,
          label:    i.label.trim(),
          category: i.category,
          amount:   parseFloat(i.amount) || 0,
          sort_order: idx,
        }))
      )
    }

    setStructureId(sid)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const entryItems = items.filter(i => i.category === 'entry')
  const semItems   = items.filter(i => i.category === 'semester')
  const entryTotal = entryItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const semPerSem  = semItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const totalSemFees = semPerSem * totalSemesters
  const grandTotal = entryTotal + totalSemFees

  const selectedProgramName = programs.find(p => p.id === selectedProgram)?.program_name || ''

  return (
    <div className="p-6">
      <PageHeader title="Fee Management" subtitle="Program-wise fee structure setup" />

      {/* Selectors */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <select
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] bg-white min-w-[220px]"
          value={selectedProgram}
          onChange={e => setSelectedProgram(e.target.value)}
        >
          <option value="">— Select Program —</option>
          {programs.map(p => <option key={p.id} value={p.id}>{p.program_name}</option>)}
        </select>

        <select
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] bg-white"
          value={selectedSession}
          onChange={e => setSelectedSession(e.target.value)}
        >
          <option value="">All Sessions</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
        </select>

        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
          <span className="text-sm text-gray-500 whitespace-nowrap">Total Semesters</span>
          <select
            className="text-sm font-bold text-[#933d18] focus:outline-none bg-transparent"
            value={totalSemesters}
            onChange={e => setTotalSemesters(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {selectedProgram && (
          <Button onClick={handleSave} disabled={saving}>
            <Save size={14} />
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Fee Structure'}
          </Button>
        )}
      </div>

      {!selectedProgram ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-300">
          <GraduationCap size={52} className="mb-3" />
          <p className="text-base font-semibold text-gray-400">Select a program to configure fees</p>
          <p className="text-sm text-gray-300 mt-1">Program-wise fee structure yahan set karein</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Entry Fees Column */}
          <FeeColumn
            title="Entry Fees"
            subtitle="One-time at admission"
            color="amber"
            items={entryItems}
            total={entryTotal}
            totalLabel="Entry Total"
            addLabel="Add Entry Fee"
            onAdd={() => addItem('entry')}
            onUpdate={update}
            onRemove={remove}
          />

          {/* Semester Fees Column */}
          <FeeColumn
            title="Semester Fees"
            subtitle={`Per semester × ${totalSemesters} sems`}
            color="brand"
            items={semItems}
            total={semPerSem}
            totalLabel="Per Sem Total"
            addLabel="Add Semester Fee"
            onAdd={() => addItem('semester')}
            onUpdate={update}
            onRemove={remove}
          />

          {/* Summary Column */}
          <div className="space-y-4">
            {/* Grand Total Card */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gray-800 px-4 py-3">
                <h3 className="text-white font-bold text-sm">Fee Summary</h3>
                <p className="text-gray-400 text-xs mt-0.5 truncate">{selectedProgramName}</p>
              </div>
              <div className="p-4 space-y-3">
                <SummaryRow label="Entry Fees (one-time)" value={entryTotal} />
                <SummaryRow label={`Sem Fee/sem (×${totalSemesters})`} value={semPerSem} sub={`= ₹${totalSemFees.toLocaleString()}`} />
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900">Grand Total</span>
                    <span className="text-2xl font-black text-[#933d18]">₹{grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Semester-wise breakdown */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 text-sm">Semester-wise Breakdown</h3>
              </div>
              <div className="p-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-1.5 text-gray-400 font-semibold">Semester</th>
                      <th className="text-right py-1.5 text-gray-400 font-semibold">Sem Fees</th>
                      <th className="text-right py-1.5 text-gray-400 font-semibold">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: totalSemesters }, (_, i) => {
                      const semNum = i + 1
                      const cumulative = entryTotal + semPerSem * semNum
                      return (
                        <tr key={semNum} className={`border-b border-gray-50 ${semNum === 1 ? 'bg-amber-50/50' : ''}`}>
                          <td className="py-1.5 font-semibold text-gray-700">
                            {semNum === 1 ? `Sem 1 + Entry` : `Sem ${semNum}`}
                          </td>
                          <td className="py-1.5 text-right font-mono text-gray-600">
                            {semNum === 1
                              ? `₹${(entryTotal + semPerSem).toLocaleString()}`
                              : `₹${semPerSem.toLocaleString()}`}
                          </td>
                          <td className="py-1.5 text-right font-mono font-bold text-[#933d18]">
                            ₹{cumulative.toLocaleString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200">
                      <td className="py-2 font-black text-gray-900">Total</td>
                      <td className="py-2 text-right font-black text-gray-900" colSpan={2}>
                        ₹{grandTotal.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Fee breakdown list */}
            {(entryItems.length > 0 || semItems.length > 0) && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800 text-sm">All Fee Components</h3>
                </div>
                <div className="p-3 space-y-1">
                  {entryItems.filter(i => i.label && parseFloat(i.amount) > 0).map(i => (
                    <div key={i._key} className="flex justify-between text-xs py-0.5">
                      <span className="text-gray-500">{i.label} <span className="text-amber-500 text-[10px] font-bold">(entry)</span></span>
                      <span className="font-semibold text-gray-700">₹{Number(i.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  {semItems.filter(i => i.label && parseFloat(i.amount) > 0).map(i => (
                    <div key={i._key} className="flex justify-between text-xs py-0.5">
                      <span className="text-gray-500">{i.label} <span className="text-[#933d18] text-[10px] font-bold">(×{totalSemesters} sem)</span></span>
                      <span className="font-semibold text-gray-700">₹{(Number(i.amount) * totalSemesters).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

function FeeColumn({ title, subtitle, color, items, total, totalLabel, addLabel, onAdd, onUpdate, onRemove }) {
  const isBrand = color === 'brand'
  const headerBg  = isBrand ? 'bg-[#933d18]'          : 'bg-amber-500'
  const subText   = isBrand ? 'text-[#f0c9b0]'        : 'text-amber-100'
  const footerBg  = isBrand ? 'bg-[#fef9f6]'          : 'bg-amber-50'
  const footerBorder = isBrand ? 'border-[#f0e6df]'   : 'border-amber-100'
  const totalText = isBrand ? 'text-[#933d18]'         : 'text-amber-700'
  const totalVal  = isBrand ? 'text-[#933d18]'         : 'text-amber-800'
  const addBorder = isBrand ? 'border-[#933d18]/30'    : 'border-amber-300'
  const addText   = isBrand ? 'text-[#933d18]'         : 'text-amber-600'
  const addHover  = isBrand ? 'hover:bg-[#933d18]/5'  : 'hover:bg-amber-50'
  const focusBorder = 'focus:border-[#933d18]'

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className={`${headerBg} px-4 py-3`}>
        <h3 className="text-white font-bold text-sm">{title}</h3>
        <p className={`${subText} text-xs mt-0.5`}>{subtitle}</p>
      </div>

      <div className="p-3 flex-1 space-y-2">
        {items.map(item => (
          <div key={item._key} className="flex items-center gap-2">
            <input
              className={`flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none ${focusBorder}`}
              placeholder="Fee name"
              value={item.label}
              onChange={e => onUpdate(item._key, 'label', e.target.value)}
            />
            <div className="relative w-28 shrink-0">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
              <input
                className={`w-full border border-gray-200 rounded-lg pl-5 pr-2 py-1.5 text-sm text-right focus:outline-none ${focusBorder}`}
                type="number"
                min="0"
                value={item.amount}
                onChange={e => onUpdate(item._key, 'amount', e.target.value)}
              />
            </div>
            <button onClick={() => onRemove(item._key)} className="text-red-300 hover:text-red-500 shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        <button
          onClick={onAdd}
          className={`w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold ${addText} border border-dashed ${addBorder} rounded-lg ${addHover} transition-colors mt-1`}
        >
          <Plus size={13} /> {addLabel}
        </button>
      </div>

      <div className={`${footerBg} px-4 py-2.5 border-t ${footerBorder}`}>
        <div className="flex justify-between text-sm">
          <span className={`${totalText} font-semibold`}>{totalLabel}</span>
          <span className={`font-black ${totalVal}`}>₹{total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, sub }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-sm text-gray-500">{label}</span>
      <div className="text-right">
        <span className="font-semibold text-gray-800 text-sm">₹{value.toLocaleString()}</span>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}
