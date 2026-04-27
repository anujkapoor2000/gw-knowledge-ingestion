import React, { useState, useRef } from 'react'
import { Upload, X, FileText, Loader2, CheckCircle2, AlertCircle, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { ingestFile, STAGE_LABELS } from '../lib/ingestion.js'
import { formatBytes, fileTypeIcon, fileTypeLabel } from '../lib/utils.js'
import { DOC_TYPES, DOMAINS, CLIENT_NAMES } from '../data/taxonomy.js'

const ACCEPTED = '.pdf,.docx,.doc,.xlsx,.xls'

function FileRow({ item, onRemove }) {
  const [expanded, setExpanded] = useState(false)
  const statusIcon = {
    queued: null,
    processing: <Loader2 size={14} className="spin" style={{ color: 'var(--indigo-light)' }} />,
    done: <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />,
    error: <AlertCircle size={14} style={{ color: 'var(--error)' }} />,
  }

  return (
    <div className="card p-4 fade-in">
      <div className="flex items-start gap-3">
        <div className="text-2xl mt-0.5 flex-shrink-0">{fileTypeIcon(item.file.name)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-slate-100 truncate">{item.file.name}</span>
            <span className="badge badge-slate flex-shrink-0">{fileTypeLabel(item.file.name)}</span>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
              {formatBytes(item.file.size)}
            </span>
            <div className="ml-auto flex-shrink-0">{statusIcon[item.status]}</div>
          </div>

          {/* Progress bar */}
          {item.status === 'processing' && (
            <div className="mb-2">
              <div className="progress-track mb-1">
                <div className="progress-fill" style={{ width: `${item.progress}%` }} />
              </div>
              <div className="text-xs font-mono" style={{ color: 'var(--indigo-light)' }}>
                {item.stage ? STAGE_LABELS[item.stage] : '...'} — {item.progress}%
              </div>
              {item.message && (
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{item.message}</div>
              )}
            </div>
          )}

          {item.status === 'done' && item.report && (
            <div className="text-xs" style={{ color: 'var(--success)' }}>
              ✓ {item.report.chunks} chunks ingested
              {item.report.tags?.modules?.length > 0 && (
                <span style={{ color: 'var(--text-tertiary)' }}> · {item.report.tags.modules.join(', ')}</span>
              )}
              {item.report.errors?.length > 0 && (
                <span style={{ color: 'var(--warning)' }}> · {item.report.errors.length} warning(s)</span>
              )}
            </div>
          )}

          {item.status === 'error' && (
            <div className="text-xs" style={{ color: 'var(--error)' }}>✗ {item.error}</div>
          )}
        </div>

        {item.status === 'queued' && (
          <button onClick={() => onRemove(item.id)}
            className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 transition"
            style={{ color: 'var(--text-tertiary)' }}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Expandable error details */}
      {item.status === 'done' && item.report?.errors?.length > 0 && (
        <div className="mt-2">
          <button
            className="text-xs flex items-center gap-1"
            style={{ color: 'var(--warning)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {item.report.errors.length} warning(s)
          </button>
          {expanded && (
            <ul className="mt-1 text-xs space-y-0.5 pl-3" style={{ color: 'var(--text-tertiary)' }}>
              {item.report.errors.map((e, i) => <li key={i}>• {e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function UploadTab({ onIngested, showToast }) {
  const [files, setFiles] = useState([]) // { id, file, status, progress, stage, message, report, error }
  const [dragging, setDragging] = useState(false)
  const [meta, setMeta] = useState({
    docType: 'Other',
    domain: 'Guidewire Practice',
    clientName: '',
    isClientDocument: false,
    uploadedBy: '',
    notes: '',
  })
  const [running, setRunning] = useState(false)
  const inputRef = useRef()

  const addFiles = (newFiles) => {
    const items = Array.from(newFiles).map(f => ({
      id: `${f.name}_${Date.now()}`,
      file: f,
      status: 'queued',
      progress: 0,
      stage: null,
      message: '',
      report: null,
      error: null,
    }))
    setFiles(prev => [...prev, ...items])
  }

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id))

  const updateFile = (id, patch) => setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const queuedFiles = files.filter(f => f.status === 'queued')

  const runIngestion = async () => {
    if (queuedFiles.length === 0 || running) return
    setRunning(true)
    let anySuccess = false

    for (const item of queuedFiles) {
      updateFile(item.id, { status: 'processing', progress: 2 })

      const result = await ingestFile(
        item.file,
        {
          ...meta,
          isClientDocument: meta.domain === 'Client Document' || meta.isClientDocument,
        },
        (stage, pct, message) => {
          updateFile(item.id, { stage, progress: Math.round(pct), message })
        }
      )

      if (result.success) {
        updateFile(item.id, { status: 'done', progress: 100, report: result.report })
        anySuccess = true
        showToast('success', `${item.file.name} ingested — ${result.report.chunks} chunks`)
      } else {
        updateFile(item.id, { status: 'error', error: result.error, report: result.report })
        showToast('error', `${item.file.name}: ${result.error}`)
      }
    }

    setRunning(false)
    if (anySuccess) onIngested()
  }

  const clearCompleted = () => setFiles(prev => prev.filter(f => f.status === 'queued' || f.status === 'processing'))

  const hasCompleted = files.some(f => f.status === 'done' || f.status === 'error')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Drop zone */}
        <div className="lg:col-span-3 space-y-4">
          <div
            className={`dropzone p-10 text-center ${dragging ? 'dragging' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input ref={inputRef} type="file" accept={ACCEPTED} multiple className="hidden"
              onChange={e => addFiles(e.target.files)} />
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'var(--indigo-dim)', border: '1px solid var(--border-strong)' }}>
              <Upload size={24} style={{ color: 'var(--indigo-light)' }} />
            </div>
            <div className="font-display text-lg font-semibold text-slate-100 mb-1">
              Drop documents here
            </div>
            <div className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              or click to browse
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {['PDF', 'Excel', 'Word'].map(t => (
                <span key={t} className="badge badge-slate">{t}</span>
              ))}
            </div>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  {files.length} file{files.length > 1 ? 's' : ''} queued
                </span>
                {hasCompleted && (
                  <button className="text-xs" style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={clearCompleted}>
                    Clear completed
                  </button>
                )}
              </div>
              {files.map(item => (
                <FileRow key={item.id} item={item} onRemove={removeFile} />
              ))}
            </div>
          )}
        </div>

        {/* Metadata form */}
        <div className="lg:col-span-2">
          <div className="card-glow p-5 sticky top-24">
            <h3 className="font-display text-base font-bold text-slate-100 mb-4">
              Document Metadata
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>
                  Document Type
                </label>
                <select className="input" value={meta.docType} onChange={e => setMeta(m => ({ ...m, docType: e.target.value }))}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>
                  Domain
                </label>
                <select className="input" value={meta.domain}
                  onChange={e => setMeta(m => ({ ...m, domain: e.target.value, isClientDocument: e.target.value === 'Client Document' }))}>
                  {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {(meta.domain === 'Client Document' || meta.isClientDocument) && (
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>
                    Client Name
                  </label>
                  <select className="input" value={meta.clientName} onChange={e => setMeta(m => ({ ...m, clientName: e.target.value }))}>
                    <option value="">Select client...</option>
                    {CLIENT_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-mono uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>
                  Uploaded By
                </label>
                <input className="input" placeholder="Your name / team..." value={meta.uploadedBy}
                  onChange={e => setMeta(m => ({ ...m, uploadedBy: e.target.value }))} />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-tertiary)' }}>
                  Notes (optional)
                </label>
                <textarea className="input resize-none" rows={2} placeholder="Any context about this document..."
                  value={meta.notes} onChange={e => setMeta(m => ({ ...m, notes: e.target.value }))} />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button
                className="btn-primary w-full justify-center"
                disabled={queuedFiles.length === 0 || running}
                onClick={runIngestion}
              >
                {running
                  ? <><Loader2 size={14} className="spin" /> Processing...</>
                  : <><Plus size={14} /> Ingest {queuedFiles.length > 0 ? queuedFiles.length : ''} Document{queuedFiles.length !== 1 ? 's' : ''}</>
                }
              </button>
              {queuedFiles.length === 0 && files.length === 0 && (
                <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                  Drop files above to begin
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
