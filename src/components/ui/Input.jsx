export default function Input({ label, error, hint, className = '', type, onChange, capitalize, ...props }) {
  // Auto-capitalise the first letter of every word in plain text fields
  // (names, addresses…) — e.g. "alok kumar" -> "Alok Kumar".
  // Skipped for email/password/number/tel/url and when capitalize={false}.
  const shouldCap = capitalize !== false && (!type || type === 'text')
  const handleChange = onChange
    ? (e) => {
        if (shouldCap && e.target.value) {
          const v = e.target.value
          const cap = v.replace(/(^|\s)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
          if (cap !== v) e.target.value = cap
        }
        onChange(e)
      }
    : undefined

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold text-gray-600 ml-0.5">
          {label}
        </label>
      )}
      <input
        type={type}
        onChange={handleChange}
        className={`w-full bg-white border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-[#933d18]/20 focus:border-[#933d18] transition-all
          disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
          ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100 bg-red-50/30' : ''}
          ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-[11px] text-gray-400 ml-0.5">{hint}</p>}
      {error && <p className="text-[11px] text-red-500 ml-0.5 flex items-center gap-1">⚠ {error}</p>}
    </div>
  )
}

export function Select({ label, error, hint, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold text-gray-600 ml-0.5">
          {label}
        </label>
      )}
      <select
        className={`w-full bg-white border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900
          focus:outline-none focus:ring-2 focus:ring-[#933d18]/20 focus:border-[#933d18] transition-all
          disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
          ${error ? 'border-red-400 focus:border-red-500' : ''}
          ${className}`}
        {...props}
      >
        {children}
      </select>
      {hint && !error && <p className="text-[11px] text-gray-400 ml-0.5">{hint}</p>}
      {error && <p className="text-[11px] text-red-500 ml-0.5">⚠ {error}</p>}
    </div>
  )
}

export function Textarea({ label, error, hint, className = '', onChange, capitalize, ...props }) {
  // Sentence case: capitalise the first letter of the text and the first
  // letter after each sentence end (. ! ?) — e.g. "ga kappor" -> "Ga kappor".
  // Skipped when capitalize={false}.
  const handleChange = onChange
    ? (e) => {
        if (capitalize !== false && e.target.value) {
          const v = e.target.value
          const cap = v.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
          if (cap !== v) e.target.value = cap
        }
        onChange(e)
      }
    : undefined

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold text-gray-600 ml-0.5">
          {label}
        </label>
      )}
      <textarea
        rows={3}
        onChange={handleChange}
        className={`w-full bg-white border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-[#933d18]/20 focus:border-[#933d18] transition-all resize-none
          disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
          ${error ? 'border-red-400' : ''}
          ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-[11px] text-gray-400 ml-0.5">{hint}</p>}
      {error && <p className="text-[11px] text-red-500 ml-0.5">⚠ {error}</p>}
    </div>
  )
}
