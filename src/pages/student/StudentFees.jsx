import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { IndianRupee } from 'lucide-react'

function calcTotals(feeItems, totalSems) {
  const sems = totalSems || 1
  let entryTotal = 0, divideTotal = 0, multiplyPerSem = 0, multiply2PerSem = 0
  ;(feeItems || []).forEach(i => {
    const a = parseFloat(i.amount) || 0
    if (i.category === 'entry')     entryTotal      += a
    if (i.category === 'divide')    divideTotal     += a
    if (i.category === 'multiply')  multiplyPerSem  += a
    if (i.category === 'multiply2') multiply2PerSem += a
  })
  const dividePerSem = sems > 0 ? divideTotal / sems : 0
  const perSem1    = dividePerSem + multiplyPerSem
  const perSem     = dividePerSem + multiplyPerSem + multiply2PerSem
  const grandTotal = entryTotal + divideTotal + multiplyPerSem * sems + multiply2PerSem * Math.max(sems - 1, 0)
  return { entryTotal, dividePerSem, multiplyPerSem, multiply2PerSem, perSem1, perSem, grandTotal }
}

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function StudentFees() {
  const { student } = useStudentAuth()
  const [feeData, setFeeData] = useState(null)
  const [prog, setProg] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student?.id) return
    async function load() {
      const { data: s } = await supabase
        .from('students')
        .select('programme_id, session_id, programs(program_name, short_name, duration, semester_year)')
        .eq('id', student.id)
        .single()
      if (!s) { setLoading(false); return }
      setProg(s.programs)
      const { data: fs } = await supabase
        .from('fee_structures')
        .select('*')
        .eq('programme_id', s.programme_id)
        .eq('session_id', s.session_id)
        .maybeSingle()
      setFeeData(fs)
      setLoading(false)
    }
    load()
  }, [student?.id])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>

  const totalSems = prog?.semester_year === 'Year'
    ? (prog?.duration || 1) * 2
    : (prog?.duration || 1)

  const feeItems = feeData?.fee_items || []
  const totals = calcTotals(feeItems, totalSems)
  const semCols = Array.from({ length: totalSems }, (_, i) => i)

  const summaryCards = [
    { label: 'One-time Fee', value: fmt(totals.entryTotal), color: 'text-gray-900' },
    { label: 'Sem 1 Total', value: fmt(totals.entryTotal + totals.perSem1), color: 'text-[#933d18]' },
    { label: 'Per Sem (Sem 2+)', value: fmt(totals.perSem), color: 'text-gray-900' },
    { label: 'Grand Total', value: fmt(totals.grandTotal), color: 'text-emerald-600' },
  ]

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-black text-gray-900">Fee Details</h1>
        {prog && <p className="text-sm text-gray-500 mt-0.5">{prog.program_name}</p>}
      </div>

      {!feeData ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <IndianRupee size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">Fee structure not available for your program yet.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-lg font-black mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Semester-wise breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Semester-wise Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase min-w-[160px]">Fee Head</th>
                    {semCols.map(i => (
                      <th key={i} className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                        Sem {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {feeItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-800">{item.label}</td>
                      {semCols.map(i => {
                        const a = parseFloat(item.amount) || 0
                        let val = '—'
                        if (item.category === 'entry')     val = i === 0 ? fmt(a) : '—'
                        else if (item.category === 'divide')    val = fmt(a / totalSems)
                        else if (item.category === 'multiply')  val = fmt(a)
                        else if (item.category === 'multiply2') val = i === 0 ? '—' : fmt(a)
                        return (
                          <td key={i} className={`px-4 py-3 text-right font-mono text-xs ${val === '—' ? 'text-gray-300' : 'text-gray-700'}`}>
                            {val}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#933d18]/5 border-t-2 border-[#933d18]/20">
                  <tr>
                    <td className="px-4 py-3 font-black text-gray-900 uppercase text-xs tracking-wider">Total</td>
                    {semCols.map(i => (
                      <td key={i} className="px-4 py-3 text-right font-black text-[#933d18] font-mono">
                        {i === 0 ? fmt(totals.entryTotal + totals.perSem1) : fmt(totals.perSem)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Cumulative running total */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Cumulative Fee (Running Total)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {semCols.map(i => (
                      <th key={i} className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">
                        Sem {i + 1}
                      </th>
                    ))}
                    <th className="text-right px-4 py-2.5 text-xs font-bold text-emerald-600 uppercase whitespace-nowrap">
                      Grand Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {semCols.map(i => {
                      const cumul = i === 0
                        ? totals.entryTotal + totals.perSem1
                        : totals.entryTotal + totals.perSem1 + totals.perSem * i
                      return (
                        <td key={i} className="px-4 py-3 text-right font-semibold font-mono text-gray-700">
                          {fmt(cumul)}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-right font-black text-emerald-600 font-mono">
                      {fmt(totals.grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
