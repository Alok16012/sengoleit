export function Table({ children, className = '' }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
      <table className={`min-w-full ${className}`}>{children}</table>
    </div>
  )
}

export function Thead({ children }) {
  return (
    <thead className="bg-gradient-to-r from-[#933d18]/6 to-[#933d18]/2 border-b border-[#933d18]/10">
      {children}
    </thead>
  )
}

export function Tbody({ children }) {
  return <tbody className="divide-y divide-gray-50">{children}</tbody>
}

export function Th({ children, className = '' }) {
  return (
    <th className={`px-5 py-3.5 text-left text-[11px] font-extrabold text-[#933d18]/80 uppercase tracking-wider whitespace-nowrap ${className}`}>
      {children}
    </th>
  )
}

export function Td({ children, className = '', colSpan }) {
  return (
    <td
      colSpan={colSpan}
      className={`px-5 py-3.5 text-sm text-gray-700 group-hover:bg-gray-50/70 transition-colors ${className}`}
    >
      {children}
    </td>
  )
}

export function Tr({ children, className = '', onClick }) {
  return (
    <tr
      onClick={onClick}
      className={`group transition-colors hover:bg-orange-50/30 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </tr>
  )
}
