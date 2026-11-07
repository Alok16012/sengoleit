import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { Eye, EyeOff, CheckCircle } from 'lucide-react'

// The signed-in user changes their own login password — the admin used to
// need someone with Supabase dashboard access to do it.
//
// The current password is checked first (by signing in with it again), so a
// session left open on a shared computer cannot be used to take the account
// over by setting a new password.
export default function ChangePasswordModal({ isOpen, onClose, email }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  function close() {
    if (busy) return
    setCurrent(''); setNext(''); setConfirm(''); setError(''); setDone(false); setShow(false)
    onClose()
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!current) return setError('Enter your current password.')
    if (next.length < 8) return setError('The new password must be at least 8 characters.')
    if (next !== confirm) return setError('The new password and its confirmation do not match.')
    if (next === current) return setError('The new password is the same as the current one.')
    setBusy(true)
    const check = await supabase.auth.signInWithPassword({ email, password: current })
    if (check.error) {
      setBusy(false)
      return setError('The current password is not correct.')
    }
    const { error: updErr } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (updErr) return setError('Could not change the password: ' + updErr.message)
    setDone(true)
  }

  const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/20 focus:border-[#933d18]'

  return (
    <Modal isOpen={isOpen} onClose={close} title="Change Password" size="sm" allowMaximize={false}>
      {done ? (
        <div className="text-center space-y-3 py-2">
          <CheckCircle size={36} className="mx-auto text-emerald-600" />
          <p className="text-sm font-semibold text-gray-900">Password changed</p>
          <p className="text-xs text-gray-500">Use the new password the next time you sign in.</p>
          <Button onClick={close} className="w-full justify-center">Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-xs text-gray-500 break-all">Signed in as <span className="font-semibold text-gray-700">{email}</span></p>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Current Password</label>
            <input type={show ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)}
              autoComplete="current-password" className={inputCls} autoFocus />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">New Password</label>
            <input type={show ? 'text' : 'password'} value={next} onChange={e => setNext(e.target.value)}
              autoComplete="new-password" className={inputCls} placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Confirm New Password</label>
            <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password" className={inputCls} />
          </div>
          <button type="button" onClick={() => setShow(s => !s)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
            {show ? <EyeOff size={13} /> : <Eye size={13} />} {show ? 'Hide passwords' : 'Show passwords'}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={close} disabled={busy} className="flex-1 justify-center">Cancel</Button>
            <Button type="submit" disabled={busy} className="flex-1 justify-center">{busy ? 'Saving…' : 'Change Password'}</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
