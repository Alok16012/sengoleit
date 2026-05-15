const variants = {
  pending:          'bg-amber-50 text-amber-700 border-amber-200 ring-amber-100',
  reviewing:        'bg-blue-50 text-blue-700 border-blue-200 ring-blue-100',
  'document verified': 'bg-purple-50 text-purple-700 border-purple-200 ring-purple-100',
  'account section': 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-indigo-100',
  approved:         'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100',
  active:           'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100',
  verified:         'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100',
  admitted:         'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100',
  rejected:         'bg-red-50 text-red-700 border-red-200 ring-red-100',
  inactive:         'bg-gray-100 text-gray-500 border-gray-200 ring-gray-100',
  default:          'bg-[#933d18]/5 text-[#933d18] border-[#933d18]/20 ring-[#933d18]/10',
}

const dots = {
  pending: 'bg-amber-400',
  reviewing: 'bg-blue-400',
  'document verified': 'bg-purple-400',
  'account section': 'bg-indigo-400',
  approved: 'bg-emerald-400',
  active: 'bg-emerald-400',
  verified: 'bg-emerald-400',
  admitted: 'bg-emerald-400',
  rejected: 'bg-red-400',
  inactive: 'bg-gray-300',
  default: 'bg-[#933d18]',
}

export default function Badge({ children, status }) {
  const key = status?.toLowerCase() || 'default'
  const cls = variants[key] || variants.default
  const dot = dots[key] || dots.default
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide capitalize ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />
      {children}
    </span>
  )
}
