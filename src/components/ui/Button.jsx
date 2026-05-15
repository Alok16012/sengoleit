export default function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed select-none'

  const variants = {
    primary:  'bg-[#933d18] text-white hover:bg-[#7d3314] shadow-sm shadow-[#933d18]/30',
    secondary:'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger:   'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-500/30',
    outline:  'border border-[#933d18]/30 text-[#933d18] hover:bg-[#933d18]/5 hover:border-[#933d18]',
    ghost:    'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
    white:    'bg-white text-[#933d18] border border-gray-200 hover:bg-gray-50 shadow-sm',
    success:  'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-500/30',
  }

  const sizes = {
    xs: 'px-2.5 py-1 text-xs',
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button className={`${base} ${variants[variant] || variants.primary} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  )
}
