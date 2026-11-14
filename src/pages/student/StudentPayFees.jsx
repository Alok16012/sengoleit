import { useEffect, useState } from 'react'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import StudentPayOnline from '../../components/StudentPayOnline'

// Pay Fees — only what is due and the PayU button. The full fee structure
// (Fee Details) stays hidden from students by university policy.
export default function StudentPayFees() {
  const { student } = useStudentAuth()
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student?.id) return
    fetchStudentSelf().then(s => { setMe(s); setLoading(false) })
  }, [student?.id])

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-black text-gray-900">Pay Fees</h1>
        <p className="text-sm text-gray-500 mt-0.5">Pay your due fee online — UPI, card or net banking.</p>
      </div>
      {loading ? <p className="text-gray-400 text-sm">Loading…</p>
        : me ? <StudentPayOnline student={me} />
        : <p className="text-gray-400 text-sm">Could not load your details. Please sign in again.</p>}
    </div>
  )
}
