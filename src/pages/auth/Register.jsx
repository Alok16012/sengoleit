import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Input, { Select } from '../../components/ui/Input'
import Button from '../../components/ui/Button'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    full_name: '', phone: '', role: 'center'
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await signUp(form.email, form.password, {
      full_name: form.full_name,
      phone: form.phone,
      role: form.role,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/login')
    }
  }

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">S</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
            <p className="text-gray-500 text-sm mt-1">Sengol University Admin Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full Name" placeholder="Your full name" value={form.full_name} onChange={set('full_name')} required />
            <Input label="Email Address" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
            <Input label="Phone Number" type="tel" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={set('phone')} />
            <Select label="Role" value={form.role} onChange={set('role')}>
              <option value="center">Center</option>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </Select>
            <Input label="Password" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
            <Input label="Confirm Password" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={set('confirmPassword')} required />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full justify-center" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
