import { Construction } from 'lucide-react'

export default function ComingSoon({ title, description }) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="text-gray-500 text-sm mt-1">{description}</p>}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
          <Construction size={32} className="text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Feature Coming Soon</h2>
        <p className="text-sm text-gray-400 max-w-xs">Yeh section abhi develop ho raha hai. Jald hi available hoga.</p>
      </div>
    </div>
  )
}
