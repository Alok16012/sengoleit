import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { Settings, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'

export default function StudentSettings() {
  const { student } = useStudentAuth()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'ok' | 'err', text }

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg(null)
    if (newPwd.trim().length < 6) return setMsg({ type: 'err', text: 'New password must be at least 6 characters.' })
    if (newPwd !== confirmPwd) return setMsg({ type: 'err', text: 'New password and confirm password do not match.' })

    setSaving(true)
    // Server-side change (student_auth.sql): the old password is verified
    // against its hash and the update runs under the session token — the
    // browser can no longer read or write the students table directly.
    if (student?.token) {
      const { data, error } = await supabase.rpc('student_change_password', {
        p_token: student.token, p_old: oldPwd, p_new: newPwd,
      })
      setSaving(false)
      if (error) return setMsg({ type: 'err', text: 'Could not update password. Please try again later.' })
      if (data?.error === 'wrong_password') return setMsg({ type: 'err', text: 'Your current password is incorrect.' })
      if (data?.error === 'weak_password') return setMsg({ type: 'err', text: 'New password must be at least 6 characters.' })
      if (data?.error) return setMsg({ type: 'err', text: 'Could not verify your account. Please sign in again.' })
      setMsg({ type: 'ok', text: 'Password changed successfully.' })
      setOldPwd(''); setNewPwd(''); setConfirmPwd('')
      return
    }

    // Legacy fallback — pre-migration session/database.
    const { data: row, error: readErr } = await supabase
      .from('students').select('login_password').eq('id', student.id).maybeSingle()
    if (readErr || !row) { setSaving(false); return setMsg({ type: 'err', text: 'Could not verify your account. Please try again.' }) }
    if ((row.login_password || '') !== oldPwd) { setSaving(false); return setMsg({ type: 'err', text: 'Your current password is incorrect.' }) }

    const { error } = await supabase.from('students').update({ login_password: newPwd }).eq('id', student.id)
    setSaving(false)
    if (error) return setMsg({ type: 'err', text: 'Could not update password. Please try again later.' })

    setMsg({ type: 'ok', text: 'Password changed successfully.' })
    setOldPwd(''); setNewPwd(''); setConfirmPwd('')
  }

  const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 focus:border-[#933d18]/40'

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <h1 className="text-xl font-black text-gray-900 flex items-center gap-2"><Settings size={20} className="text-[#933d18]" /> Settings</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <KeyRound size={16} className="text-[#933d18]" />
          <p className="text-sm font-bold text-gray-900">Change Password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-gray-500">Current Password</label>
            <input type={show ? 'text' : 'password'} value={oldPwd} onChange={e => setOldPwd(e.target.value)} className={inputCls} autoComplete="current-password" required />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500">New Password</label>
            <input type={show ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} className={inputCls} autoComplete="new-password" required />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500">Confirm New Password</label>
            <input type={show ? 'text' : 'password'} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className={inputCls} autoComplete="new-password" required />
          </div>

          <button type="button" onClick={() => setShow(s => !s)} className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-[#933d18] transition-colors">
            {show ? <EyeOff size={13} /> : <Eye size={13} />} {show ? 'Hide' : 'Show'} passwords
          </button>

          {msg && (
            <div className={`flex items-center gap-2 text-sm font-medium rounded-xl p-3 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {msg.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {msg.text}
            </div>
          )}

          <button type="submit" disabled={saving} className="w-full bg-[#933d18] hover:bg-[#7a3215] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
