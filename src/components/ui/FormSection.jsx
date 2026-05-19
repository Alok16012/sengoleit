export default function FormSection({ title, icon, children, subtitle }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 bg-gray-50 border-b border-gray-100 rounded-t-2xl">
        {icon && <span className="text-[#933d18]">{icon}</span>}
        <div>
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6 flex flex-col gap-4 rounded-b-2xl">{children}</div>
    </div>
  )
}
