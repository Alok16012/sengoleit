import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Mail, Lock } from 'lucide-react'

export default function Login() {
  const { signIn, isConfigured } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await signIn(email, password)
      if (err) throw err
      const role = data?.user?.user_metadata?.role
      if (role === 'super_center') navigate('/super-center/dashboard')
      else if (role === 'center') navigate('/center/dashboard')
      else if (role === 'student') navigate('/student/dashboard')
      else navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white overflow-hidden font-sans">

      {/* Left Panel - Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#933d18] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#933d18] via-[#ab4e2a] to-[#6b2c12] opacity-90" />
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-white/10 blur-3xl rounded-full" />
        <div className="absolute bottom-[-5%] left-[-5%] w-64 h-64 bg-orange-400/10 blur-3xl rounded-full" />

        <div className="relative z-10 w-full flex flex-col justify-center px-20">
          <div className="h-20 w-20 bg-white p-2 rounded-2xl flex items-center justify-center mb-8 border border-white/30 shadow-xl overflow-hidden">
            <img src="/assets/logo.png" alt="Sengol International University" className="w-full h-full object-contain"
              onError={e => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span style="font-size:2rem;font-weight:900;color:#933d18">S</span>' }} />
          </div>

          <h1 className="text-5xl font-black text-white mb-6 leading-[1.1] tracking-tight">
            Empowering the next <br />
            <span className="text-orange-300">Generation</span> of Leaders.
          </h1>

          <p className="text-orange-100/80 text-lg max-w-md leading-relaxed mb-10">
            Welcome to our advanced university management portal. Experience a seamless and powerful administrative workflow designed for excellence.
          </p>

          <div className="grid grid-cols-2 gap-6 max-w-sm">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/20">
              <span className="text-white text-2xl font-bold block">15k+</span>
              <span className="text-orange-200/60 text-xs font-semibold uppercase tracking-wider">Students</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/20">
              <span className="text-white text-2xl font-bold block">120+</span>
              <span className="text-orange-200/60 text-xs font-semibold uppercase tracking-wider">Programs</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-20 z-10 text-white/40 text-xs font-medium flex items-center space-x-2">
          <span>© 2026 Sengol International University</span>
          <span>•</span>
          <span>Privacy Policy</span>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 md:p-20 relative">
        <div className="w-full max-w-md">

          <div className="mb-10 flex flex-col items-center lg:items-start">
            <div className="lg:hidden h-16 w-16 bg-white p-2 border border-gray-100 rounded-xl flex items-center justify-center mb-6 shadow-md">
              <img src="/assets/logo.png" alt="Logo" className="w-full h-full object-contain"
                onError={e => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span style="font-size:1.5rem;font-weight:900;color:#933d18">S</span>' }} />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2 text-center lg:text-left">
              Sengol International
            </h2>
            <p className="text-gray-500 font-medium">Please enter your details to sign in.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {/* Email */}
              <div className="relative group">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                  <input
                    type="email"
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-4 focus:ring-[#933d18]/5 focus:border-[#933d18] focus:bg-white transition-all shadow-sm"
                    placeholder="admin@university.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="relative group">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                  <input
                    type="password"
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-4 focus:ring-[#933d18]/5 focus:border-[#933d18] focus:bg-white transition-all shadow-sm"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl font-bold text-white bg-[#933d18] hover:bg-[#b05a30] shadow-lg shadow-red-900/20 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

          </form>

          <p className="text-center text-sm text-gray-400 mt-8">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#933d18] font-bold hover:underline">Register</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
