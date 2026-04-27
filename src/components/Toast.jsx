import React, { useEffect } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 4500)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null

  const icons = { success: CheckCircle2, error: XCircle, info: Info }
  const Icon = icons[toast.type] || Info

  return (
    <div className={`toast toast-${toast.type}`}>
      <Icon size={16} />
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}>
        <X size={14} />
      </button>
    </div>
  )
}
