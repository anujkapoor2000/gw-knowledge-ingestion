import React, { useState, useEffect, useCallback } from 'react'
import { Upload, Library, Search, Database, LogOut, RefreshCw } from 'lucide-react'
import LoginGate from './components/LoginGate.jsx'
import UploadTab from './components/UploadTab.jsx'
import LibraryTab from './components/LibraryTab.jsx'
import SearchTab from './components/SearchTab.jsx'
import StatsBar from './components/StatsBar.jsx'
import Toast from './components/Toast.jsx'
import { getStats } from './lib/apiClient.js'

const TABS = [
  { id: 'upload', label: 'Ingest', icon: Upload },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'search', label: 'Test Search', icon: Search },
]

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [activeTab, setActiveTab] = useState('upload')
  const [stats, setStats] = useState(null)
  const [libRefreshKey, setLibRefreshKey] = useState(0)
  const [toast, setToast] = useState(null)

  // Check session storage for existing auth
  useEffect(() => {
    if (sessionStorage.getItem('gw_kg_auth') === 'true') setAuthed(true)
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const s = await getStats()
      setStats(s)
    } catch {}
  }, [])

  useEffect(() => {
    if (authed) loadStats()
  }, [authed, libRefreshKey, loadStats])

  const showToast = (type, message) => setToast({ type, message })

  const handleIngested = () => {
    setLibRefreshKey(k => k + 1)
    loadStats()
  }

  const handleLogout = () => {
    sessionStorage.removeItem('gw_kg_auth')
    setAuthed(false)
  }

  if (!authed) return <LoginGate onLogin={() => setAuthed(true)} />

  return (
    <div className="min-h-screen">
      {/* Background grid */}
      <div className="fixed inset-0 grid-overlay pointer-events-none opacity-40" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b"
        style={{ background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(16px)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #6366F1 0%, #F43F5E 100%)' }}>
                  <Database size={18} className="text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2"
                  style={{ background: 'var(--success)', borderColor: 'var(--bg-base)' }} />
              </div>
              <div>
                <div className="font-display text-lg font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                  Knowledge <span className="gradient-text">Ingestion</span>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: 'var(--text-tertiary)' }}>
                  NTT DATA · GW Practice · Admin
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <StatsBar stats={stats} />
              <button
                className="btn-secondary px-3 py-2"
                onClick={loadStats}
                title="Refresh stats"
              >
                <RefreshCw size={13} />
              </button>
              <button
                className="btn-secondary px-3 py-2"
                onClick={handleLogout}
                title="Log out"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`tab ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <t.icon size={13} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative max-w-7xl mx-auto px-6 py-6 pb-16">
        {activeTab === 'upload' && (
          <UploadTab onIngested={handleIngested} showToast={showToast} />
        )}
        {activeTab === 'library' && (
          <LibraryTab
            refreshKey={libRefreshKey}
            onReIngest={() => setActiveTab('upload')}
            showToast={showToast}
          />
        )}
        {activeTab === 'search' && (
          <SearchTab showToast={showToast} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-4 px-6" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs flex-wrap gap-2"
          style={{ color: 'var(--text-tertiary)' }}>
          <div>NTT DATA Guidewire Practice · Knowledge Ingestion v1.0</div>
          <div className="font-mono">
            pgvector · OpenAI embeddings · Claude tagging
          </div>
        </div>
      </footer>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
