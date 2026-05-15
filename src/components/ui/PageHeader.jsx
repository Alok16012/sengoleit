import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Button from './Button'

export default function PageHeader({ title, subtitle, action, backTo, actions }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors border border-gray-200"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {action && (
          <Button onClick={action.onClick} variant={action.variant || 'primary'} size="md">
            {action.label}
          </Button>
        )}
      </div>
    </div>
  )
}
