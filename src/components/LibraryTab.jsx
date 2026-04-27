import React, { useState, useEffect } from 'react'
import { Search, Trash2, RefreshCw, ChevronRight, Loader2, Eye, FileText, Layers, Tag, Calendar } from 'lucide-react'
import { listDocuments, getChunks, deleteDocument } from '../lib/apiClient.js'
import { formatBytes, formatRelative, fileTypeIcon, fileTypeLabel, truncate } from '../lib/utils.js'

function TagList({ tags = [], type = 'module' }) {
  const cls = { module: 'tag-module', doctype: 'tag-doctype', concept: 'tag-concept', client: 'tag-client' }
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 6).map((t, i) => (
        <span key={i} className={`tag ${cls[type]}`}>{t}</span>
      ))}
      {tags.length > 6 && <span className="tag tag-module">+{tags.length - 6}</span>}
    </div>
  )
}

function ChunkPanel({ docId, onClose }) {
  const [chunks, setChunks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    getChunks(docId).then(r => { setChunks(r.chunks || []); setLoading(false) })
  }, [docId])

  return (
    <div className="card-glow rounded-xl overflow-hidden" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h3 className="font-display text-sm font-bold text-slate-100">Chunk Preview</h3>
          <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{chunks.length} chunks</span>
        </div>
        <button onClick={onClose} className="btn-secondary px-3 py-1.5 text-xs">Close</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chunk list */}
        <div className="w-48 flex-shrink-0 overflow-y-auto border-r" style={{ borderColor: 'var(--border)' }}>
          {loading && (
            <div className="p-4 text-center"><Loader2 size={16} className="spin mx-auto" style={{ color: 'var(--indigo-light)' }} /></div>
          )}
          {chunks.map((c, i) => (
            <div
              key={c.id}
              className={`chunk-card m-2 ${selected?.id === c.id ? 'selected' : ''}`}
              onClick={() => setSelected(c)}
            >
              <div className="text-xs font-mono mb-1" style={{ color: 'var(--text-tertiary)' }}>#{i + 1}</div>
              <div className="text-xs text-slate-300 leading-snug">{truncate(c.text, 60)}</div>
              <div className="flex items-center gap-1 mt-2">
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{c.word_count}w</span>
                {c.embedding && <span className="text-[10px]" style={{ color: 'var(--success)' }}>●</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Chunk detail */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Select a chunk to preview
            </div>
          ) : (
            <div className="space-y-4 fade-in">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Text</div>
                <div className="text-sm leading-relaxed p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  {selected.text}
                </div>
              </div>
              {selected.summary && (
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>AI Summary</div>
                  <div className="text-xs p-3 rounded-lg italic" style={{ background: 'var(--indigo-dim)', color: '#A5B4FC' }}>
                    {selected.summary}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Tags</div>
                <div className="space-y-2">
                  {selected.doc_type && <div><span className="tag tag-doctype">{selected.doc_type}</span></div>}
                  {selected.modules?.length > 0 && <TagList tags={selected.modules} type="module" />}
                  {selected.concepts?.length > 0 && <TagList tags={selected.concepts} type="concept" />}
                </div>
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Stats</div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div style={{ color: 'var(--text-secondary)' }}>Words: <span style={{ color: 'var(--text-primary)' }}>{selected.word_count}</span></div>
                  <div style={{ color: 'var(--text-secondary)' }}>Chars: <span style={{ color: 'var(--text-primary)' }}>{selected.char_count}</span></div>
                  <div style={{ color: 'var(--text-secondary)' }}>Embedded: <span style={{ color: selected.embedding ? 'var(--success)' : 'var(--error)' }}>{selected.embedding ? 'Yes' : 'No'}</span></div>
                  <div style={{ color: 'var(--text-secondary)' }}>Score: <span style={{ color: 'var(--text-primary)' }}>{selected.confidence_score ?? '—'}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LibraryTab({ refreshKey, onReIngest, showToast }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDomain, setFilterDomain] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [expandedDoc, setExpandedDoc] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await listDocuments()
      setDocs(res.documents || [])
    } catch (e) {
      showToast('error', 'Failed to load documents: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [refreshKey])

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.filename}" and all its chunks? This cannot be undone.`)) return
    setDeleting(doc.id)
    try {
      await deleteDocument(doc.id)
      showToast('success', `Deleted ${doc.filename}`)
      setDocs(d => d.filter(x => x.id !== doc.id))
      if (expandedDoc === doc.id) setExpandedDoc(null)
    } catch (e) {
      showToast('error', 'Delete failed: ' + e.message)
    } finally {
      setDeleting(null)
    }
  }

  const domains = ['All', ...new Set(docs.map(d => d.domain).filter(Boolean))]
  const statuses = ['All', 'ready', 'processing', 'error']

  const filtered = docs.filter(d => {
    if (filterDomain !== 'All' && d.domain !== filterDomain) return false
    if (filterStatus !== 'All' && d.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return `${d.filename} ${d.doc_type} ${d.domain} ${d.client_name || ''}`.toLowerCase().includes(q)
    }
    return true
  })

  const statusBadge = (s) => {
    if (s === 'ready') return <span className="badge badge-green">ready</span>
    if (s === 'processing') return <span className="badge badge-indigo"><Loader2 size={9} className="spin" />processing</span>
    if (s === 'error') return <span className="badge badge-rose">error</span>
    return <span className="badge badge-slate">{s}</span>
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input className="input pl-9 text-sm" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto text-sm" value={filterDomain} onChange={e => setFilterDomain(e.target.value)}>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="input w-auto text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn-secondary" onClick={load}><RefreshCw size={13} /></button>
        <span className="text-xs font-mono ml-auto" style={{ color: 'var(--text-tertiary)' }}>
          {filtered.length} / {docs.length} documents
        </span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><Loader2 size={20} className="spin mx-auto" style={{ color: 'var(--indigo-light)' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {docs.length === 0 ? 'No documents ingested yet. Upload your first document.' : 'No documents match your filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type / Domain</th>
                  <th>Modules</th>
                  <th>Chunks</th>
                  <th>Status</th>
                  <th>Ingested</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(doc => (
                  <React.Fragment key={doc.id}>
                    <tr>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{fileTypeIcon(doc.filename)}</span>
                          <div>
                            <div className="font-medium text-slate-100 text-sm">{doc.filename}</div>
                            {doc.client_name && (
                              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{doc.client_name}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          <span className="tag tag-doctype">{doc.doc_type || '—'}</span>
                          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{doc.domain}</div>
                        </div>
                      </td>
                      <td>
                        <TagList tags={doc.modules || []} type="module" />
                      </td>
                      <td>
                        <span className="font-mono text-sm text-slate-200">{doc.total_chunks ?? '—'}</span>
                      </td>
                      <td>{statusBadge(doc.status)}</td>
                      <td>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatRelative(doc.created_at)}</div>
                        {doc.uploaded_by && <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{doc.uploaded_by}</div>}
                      </td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          <button
                            className="w-7 h-7 rounded flex items-center justify-center hover:bg-indigo-500/10 transition"
                            style={{ color: 'var(--text-tertiary)' }}
                            onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                            title="Preview chunks"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            className="btn-danger px-2 py-1 text-xs"
                            onClick={() => handleDelete(doc)}
                            disabled={deleting === doc.id}
                            title="Delete document"
                          >
                            {deleting === doc.id ? <Loader2 size={11} className="spin" /> : <Trash2 size={11} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedDoc === doc.id && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <div className="p-4" style={{ background: 'rgba(99,102,241,0.03)' }}>
                            <ChunkPanel docId={doc.id} onClose={() => setExpandedDoc(null)} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
