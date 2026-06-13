import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { IndianRupee, Save, FileText, FileX } from 'lucide-react'

export default function CenterPricing() {
  const [withLetter, setWithLetter] = useState('')
  const [withoutLetter, setWithoutLetter] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    const { data, error } = await supabase
      .from('center_pricing')
      .select('with_letter_price, without_letter_price, updated_at')
      .eq('id', 1)
      .maybeSingle()
    if (error) setError(error.message)
    else if (data) {
      setWithLetter(String(data.with_letter_price ?? ''))
      setWithoutLetter(String(data.without_letter_price ?? ''))
      setSavedAt(data.updated_at)
    }
    setLoading(false)
  }

  async function handleSave() {
    setError(null)
    const wl = Number(withLetter)
    const wol = Number(withoutLetter)
    if (isNaN(wl) || wl < 0 || isNaN(wol) || wol < 0) {
      setError('Prices must be valid non-negative numbers.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('center_pricing')
      .update({ with_letter_price: wl, without_letter_price: wol, updated_at: new Date().toISOString() })
      .eq('id', 1)
    setSaving(false)
    if (error) { setError(error.message); return }
    setSavedAt(new Date().toISOString())
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader
        title="Center Pricing"
        subtitle="Base fee a center must pay when a super center creates it"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <FileText size={15} className="text-[#933d18]" /> With Letter Price
              </label>
              <div className="relative">
                <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number" min="0" step="any"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15"
                  value={withLetter}
                  onChange={e => setWithLetter(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <FileX size={15} className="text-[#933d18]" /> Without Letter Price
              </label>
              <div className="relative">
                <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number" min="0" step="any"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15"
                  value={withoutLetter}
                  onChange={e => setWithoutLetter(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700 leading-relaxed">
            These are the <strong>minimum</strong> base fees. When a super center creates a center, it must charge
            at least the price of the chosen letter type. The base fee becomes the center's admission credit, and
            anything charged above it is credited to the super center's wallet as commission.
          </div>

          <div className="flex items-center justify-between">
            {savedAt ? (
              <p className="text-xs text-gray-400">Last updated {new Date(savedAt).toLocaleString()}</p>
            ) : <span />}
            <Button onClick={handleSave} disabled={saving} variant="primary" size="md">
              <Save size={15} /> {saving ? 'Saving...' : 'Save Pricing'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
