import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Edit, Trash2, Plus, Search, Eye, EyeOff, Save, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'

const APPROVAL_COLORS = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
}

export default function Centers() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [visiblePasswords, setVisiblePasswords] = useState({})
  const [editingPassword, setEditingPassword] = useState({})
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('centers')
      .select('*, states:state_id(state_name)')
      .eq('center_type', 'center')
      .order('created_at', { ascending: false })
    if (error) console.error('Centers fetch error:', error)
    setData(data || [])
    setLoading(false)
  }

  async function handleDelete(id, name) {
    if (!confirm(`"${name}" ko delete karna chahte ho? Ye wapas nahi aayega.`)) return
    const { error } = await supabase.from('centers').delete().eq('id', id)
    if (error) { alert('Delete failed: ' + error.message); return }
    fetchData()
  }

  async function toggleCenterStatus(center) {
    const newStatus = center.status === 'Active' ? 'Inactive' : 'Active'
    await supabase.from('centers').update({ status: newStatus }).eq('id', center.id)
    fetchData()
  }

  async function savePassword(centerId) {
    const newPass = editingPassword[centerId]?.trim()
    if (!newPass) return
    const center = data.find(c => c.id === centerId)
    if (!center?.email) { alert('Center ka email nahi hai.'); return }

    const role = 'center'

    // Save password to DB for display
    await supabase.from('centers').update({ generated_password: newPass }).eq('id', centerId)

    // Preferred path — service-role admin API can change an EXISTING user's password.
    if (supabaseAdmin) {
      let userId = null
      try {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        userId = list?.users?.find(u => u.email?.toLowerCase() === center.email.toLowerCase())?.id || null
      } catch (_) { /* fall through to create */ }

      if (userId) {
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: newPass,
          user_metadata: { role },
        })
        if (updErr) { alert('Password update failed: ' + updErr.message); return }
        await supabase.from('profiles').upsert({ id: userId, role })
        alert(`✓ Password update ho gaya! Ab ${center.email} + naya password se login hoga.`)
      } else {
        const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
          email: center.email,
          password: newPass,
          email_confirm: true,
          user_metadata: { role },
        })
        if (cErr) { alert('User create failed: ' + cErr.message); return }
        if (created?.user) await supabase.from('profiles').upsert({ id: created.user.id, role })
        alert(`✓ Account ban gaya! Ab ${center.email} + password se login hoga.`)
      }
      setEditingPassword(prev => { const n = { ...prev }; delete n[centerId]; return n })
      fetchData()
      return
    }

    // Fallback (no service key) — signUp can only create NEW users, not change existing passwords.
    const { data: { session: adminSession } } = await supabase.auth.getSession()
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: center.email,
      password: newPass,
      options: { data: { role } }
    })
    if (!signUpErr && signUpData?.user) {
      await supabase.from('profiles').upsert({ id: signUpData.user.id, role })
    }
    if (adminSession?.access_token) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      })
    }

    if (signUpErr && signUpErr.message.toLowerCase().includes('already registered')) {
      alert(`Password actually change NAHI hua — yeh email already registered hai aur existing user ka password sirf service key se badalta hai.\n\nAbhi ke liye: Supabase Dashboard → Authentication → Users → "${center.email}" → Reset/Update password.\n\nPermanent fix: .env mein asli VITE_SUPABASE_SERVICE_KEY daalo.`)
    } else if (signUpErr) {
      alert('Error: ' + signUpErr.message)
    } else {
      alert(`✓ Password set! Ab ${center.email} + password se login hoga.`)
    }

    setEditingPassword(prev => { const n = { ...prev }; delete n[centerId]; return n })
    fetchData()
  }

  const verifiedCount = data.filter(c => c.approval_status === 'approved').length
  const unverifiedCount = data.length - verifiedCount

  const filtered = data
    .filter(c =>
      statusFilter === 'all' ? true :
      statusFilter === 'verified' ? c.approval_status === 'approved' :
      c.approval_status !== 'approved'
    )
    .filter(c =>
      `${c.center_name} ${c.center_code} ${c.contact_person} ${c.phone}`.toLowerCase().includes(search.toLowerCase())
    )

  return (
    <div className="p-6">
      <PageHeader
        title="Centers"
        subtitle={`${data.length} centers`}
        action={{ label: <><Plus size={15} /> Add Center</>, onClick: () => navigate('/admin/centers/new') }}
      />

      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'all', label: 'All', count: data.length },
          { key: 'verified', label: 'Verified', count: verifiedCount },
          { key: 'unverified', label: 'Not Verified', count: unverifiedCount },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              statusFilter === t.key ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-2 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.key === 'verified' ? 'bg-emerald-500' : t.key === 'unverified' ? 'bg-amber-500' : 'bg-gray-400'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
          placeholder="Search centers..."
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
              <Th>Center Name</Th>
              <Th>Code</Th>
              <Th>Login ID / Password</Th>
              <Th>Contact Person</Th>
              <Th>State</Th>
              <Th>Virtual Balance</Th>
              <Th>Approval</Th>
              <Th>Status</Th>
              <Th>Activate/Deactivate</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={11} className="text-center text-gray-400 py-12">No centers found</Td></Tr>
            ) : filtered.map((c, i) => (
              <Tr key={c.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{c.center_name}</p>
                  {c.email && <p className="text-xs text-gray-400 mt-0.5">{c.email}</p>}
                </Td>
                <Td className="text-gray-500 font-mono text-xs">{c.center_code || '—'}</Td>
                <Td>
                  <p className="text-xs text-gray-600 font-mono mb-1">{c.email || '—'}</p>
                  {editingPassword.hasOwnProperty(c.id) ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        type="text"
                        value={editingPassword[c.id]}
                        onChange={e => setEditingPassword(prev => ({ ...prev, [c.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') savePassword(c.id); if (e.key === 'Escape') setEditingPassword(prev => { const n = { ...prev }; delete n[c.id]; return n }) }}
                        className="border border-[#933d18]/40 rounded-lg px-2 py-1 text-xs w-28 focus:outline-none focus:border-[#933d18]"
                        placeholder="New password"
                      />
                      <button onClick={() => savePassword(c.id)} className="text-emerald-600 hover:text-emerald-700">
                        <Save size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-gray-800">
                        {c.generated_password
                          ? (visiblePasswords[c.id] ? c.generated_password : '••••••••')
                          : <span className="text-gray-300 text-xs">not set</span>}
                      </span>
                      {c.generated_password && (
                        <button onClick={() => setVisiblePasswords(prev => ({ ...prev, [c.id]: !prev[c.id] }))} className="text-gray-400 hover:text-[#933d18] transition-colors">
                          {visiblePasswords[c.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}
                      <button
                        onClick={() => setEditingPassword(prev => ({ ...prev, [c.id]: c.generated_password || '' }))}
                        className="text-gray-300 hover:text-[#933d18] transition-colors"
                        title="Set / Edit password"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                </Td>
                <Td className="text-gray-500">{c.contact_person || '—'}</Td>
                <Td className="text-gray-500 text-xs">{c.states?.state_name || '—'}</Td>
                <Td>
                  <span className="font-semibold text-emerald-700">
                    ₹{Number(c.virtual_balance || 0).toLocaleString()}
                  </span>
                </Td>
                <Td>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize ${APPROVAL_COLORS[c.approval_status] || APPROVAL_COLORS.pending}`}>
                    {c.approval_status || 'Pending'}
                  </span>
                </Td>
                <Td><Badge status={c.status?.toLowerCase()}>{c.status || 'Pending'}</Badge></Td>
                <Td>
                  {c.approval_status === 'approved' ? (
                    <button
                      onClick={() => toggleCenterStatus(c)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                        c.status === 'Active'
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      {c.status === 'Active' ? <><ToggleRight size={14} /> Deactivate</> : <><ToggleLeft size={14} /> Activate</>}
                    </button>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/centers/edit/${c.id}`)}>
                      <Edit size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id, c.center_name)}>
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
