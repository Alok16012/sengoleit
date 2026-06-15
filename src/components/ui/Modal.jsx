import { X, Maximize2, Minimize2 } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Modal({ isOpen, onClose, title, children, size = 'md', allowMaximize = true }) {
  const [maximized, setMaximized] = useState(false)

  // Reset to the default size every time the modal is (re)opened.
  useEffect(() => { if (isOpen) setMaximized(false) }, [isOpen])

  if (!isOpen) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  const showMaximize = allowMaximize && size !== 'fullscreen'

  const MaximizeBtn = showMaximize && (
    <button
      onClick={() => setMaximized(m => !m)}
      title={maximized ? 'Minimize' : 'Maximize — full page view'}
      className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
    >
      {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </button>
  )

  if (size === 'fullscreen') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    )
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${maximized ? 'p-0' : 'p-4'}`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative bg-white shadow-2xl flex flex-col border border-gray-100 transition-all duration-200 ${
        maximized
          ? 'w-screen h-screen max-w-none max-h-none rounded-none'
          : `w-full ${widths[size]} max-h-[90vh] rounded-2xl`
      }`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 ${maximized ? '' : 'rounded-t-2xl'}`}>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <div className="flex items-center gap-1">
            {MaximizeBtn}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}
