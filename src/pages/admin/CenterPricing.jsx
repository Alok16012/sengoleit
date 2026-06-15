import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import { IndianRupee, Search, Save, CheckCircle2 } from 'lucide-react'

export default function CenterPricing() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    const { data, error } = await supabase
      .from('centers')
      .select('id, center_name, center_code, email, with_letter_price, without_letter_price')
      .eq('center_type', 'super_center')
      .order('center_name')
    if (error) setError(error.message)
    else setRows((data || []).map(r => ({
      ...r,
      with_letter_price: String(r.with_letter_price ?? ''),
      without_letter_price: String(r.without_letter_price ?? ''),
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function setField(id, key, val) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [key]: val } : r))
    if (savedId === id) setSavedId(null)
  }

  async function handleSave(row) {
    setError(null)
    const wl = Number(row.with_letter_price)
    const wol = Number(row.without_letter_price)
    if (isNaN(wl) || wl < 0 || isNaN(wol) || wol < 0) {
      setError(`${row.center_name}: prices must be valid non-negative numbers.`)
      return
    }
    setSavingId(row.id)
    const { error } = await supabase
      .from('centers')
      .update({ with_letter_price: wl, without_letter_price: wol })
      .eq('id', row.id)
    setSavingId(null)
    if (error) { setError(error.message); return }
    setSavedId(row.id)
  }

  const filtered = rows.filter(r =>
    `${r.center_name} ${r.center_code} ${r.email}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <PageHeader
        title="Center Pricing"
        subtitle="Set the with/without letter base fee for each super center"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-xs text-amber-700 leading-relaxed">
        These are the <strong>minimum</strong> base fees per super center. When a super center creates a center, it
        must charge at least the price of the chosen letter type. The base fee becomes the center's admission credit,
        and anything charged above it is credited to the super center's wallet as commission.
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
          placeholder="Search super centers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Super Center</Th>
              <Th>Code</Th>
              <Th>With Letter (₹)</Th>
              <Th>Without Letter (₹)</Th>
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={6} className="text-center text-gray-400 py-12">No super centers found</Td></Tr>
            ) : filtered.map((r, i) => (
              <Tr key={r.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{r.center_name}</p>
                  {r.email && <p className="text-xs text-gray-400 mt-0.5">{r.email}</p>}
                </Td>
                <Td className="text-gray-500 font-mono text-xs">{r.center_code || '—'}</Td>
                <Td>
                  <div className="relative w-32">
                    <IndianRupee size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="number" min="0" step="any"
                      className="w-full pl-7 pr-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15"
                      value={r.with_letter_price}
                      onChange={e => setField(r.id, 'with_letter_price', e.target.value)}
                      placeholder="0" />
                  </div>
                </Td>
                <Td>
                  <div className="relative w-32">
                    <IndianRupee size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="number" min="0" step="any"
                      className="w-full pl-7 pr-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15"
                      value={r.without_letter_price}
                      onChange={e => setField(r.id, 'without_letter_price', e.target.value)}
                      placeholder="0" />
                  </div>
                </Td>
                <Td>
                  <button onClick={() => handleSave(r)} disabled={savingId === r.id}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#933d18] hover:bg-[#933d18]/90 disabled:opacity-60 px-3 py-2 rounded-lg transition-all">
                    {savedId === r.id ? <><CheckCircle2 size={13} /> Saved</> : <><Save size={13} /> {savingId === r.id ? 'Saving...' : 'Save'}</>}
                  </button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
