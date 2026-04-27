import React from 'react'
import { FileText, Layers, Tag, Search } from 'lucide-react'

export default function StatsBar({ stats }) {
  if (!stats) return null
  const items = [
    { icon: FileText, label: 'Documents', value: stats.totalDocs ?? 0 },
    { icon: Layers, label: 'Chunks', value: (stats.totalChunks ?? 0).toLocaleString() },
    { icon: Tag, label: 'Avg Tags/Chunk', value: stats.avgTags ?? '—' },
    { icon: Search, label: 'Searchable', value: stats.embeddedChunks ? `${stats.embeddedChunks.toLocaleString()}` : '0' },
  ]

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {items.map((item, i) => (
        <div key={i}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
        >
          <item.icon size={11} style={{ color: 'var(--indigo-light)' }} />
          <span style={{ color: 'var(--text-tertiary)' }}>{item.label}:</span>
          <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}
