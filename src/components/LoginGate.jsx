import React, { useState } from 'react'
import { Lock, Eye, EyeOff, Loader2, Database } from 'lucide-react'
import { login } from '../lib/apiClient.js'

export default function LoginGate({ onLogin }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setError('')
    try {
      const res = await login(password)
      if (res.ok) {
        sessionStorage.setItem('gw_kg_auth', 'true')
        onLogin()
      } else {
        setError('Invalid password')
      }
    } catch {
      setError('Authentication failed — check your connection')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 grid-overlay">
      <div className="login-card fade-in">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #F43F5E 100%)' }}>
            <Database size={22} className="text-white" />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-slate-100 leading-tight">
              Knowledge <span className="gradient-text">Ingestion</span>
            </div>
            <div className="text-xs font-mono" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.15em' }}>
              NTT DATA · GW PRACTICE
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-slate-100 mb-1">Admin Access</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Enter your admin password to access the knowledge base ingestion pipeline.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="text-xs font-mono uppercase tracking-wider mb-2 block"
              style={{ color: 'var(--text-tertiary)' }}>
              Admin Password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-tertiary)' }} />
              <input
                className="input pl-9 pr-10"
                type={show ? 'text' : 'password'}
                placeholder="Enter password..."
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                autoFocus
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setShow(s => !s)}
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm"
              style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', color: '#FB7185' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full justify-center" disabled={loading || !password}>
            {loading ? <Loader2 size={14} className="spin" /> : <Lock size={14} />}
            {loading ? 'Authenticating...' : 'Access Knowledge Base'}
          </button>
        </form>

        <p className="text-xs text-center mt-6" style={{ color: 'var(--text-tertiary)' }}>
          Set <span className="font-mono">ADMIN_PASSWORD</span> in Vercel environment variables
        </p>
      </div>
    </div>
  )
}
