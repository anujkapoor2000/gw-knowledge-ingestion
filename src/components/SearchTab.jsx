import React, { useState } from 'react'
import { Search, Loader2, Sparkles, FileText, Tag, ChevronDown, ChevronUp, Bot } from 'lucide-react'
import { searchKnowledge } from '../lib/apiClient.js'
import { truncate } from '../lib/utils.js'
import { GW_MODULES, DOC_TYPES } from '../data/taxonomy.js'

function ChunkResult({ chunk, rank }) {
  const [expanded, setExpanded] = useState(false)
  const score = chunk.similarity ? `${(chunk.similarity * 100).toFixed(1)}%` : '—'

  return (
    <div className="card p-4 fade-in">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold"
          style={{ background: 'var(--indigo-dim)', color: 'var(--indigo-light)' }}>
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-medium text-slate-200 truncate">{chunk.filename}</span>
            {chunk.doc_type && <span className="tag tag-doctype">{chunk.doc_type}</span>}
            <span className="text-xs font-mono ml-auto" style={{ color: 'var(--success)' }}>
              {score} match
            </span>
          </div>
          {chunk.summary && (
            <div className="text-xs italic mb-2" style={{ color: '#A5B4FC' }}>{chunk.summary}</div>
          )}
          <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {expanded ? chunk.text : truncate(chunk.text, 200)}
          </div>
          <button
            className="text-xs mt-1 flex items-center gap-1"
            style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? <><ChevronUp size={10} /> Show less</> : <><ChevronDown size={10} /> Show full chunk</>}
          </button>
        </div>
      </div>
      {(chunk.modules?.length > 0 || chunk.concepts?.length > 0) && (
        <div className="flex flex-wrap gap-1 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          {(chunk.modules || []).map((m, i) => <span key={i} className="tag tag-module">{m}</span>)}
          {(chunk.concepts || []).slice(0, 4).map((c, i) => <span key={i} className="tag tag-concept">{c}</span>)}
        </div>
      )}
    </div>
  )
}

export default function SearchTab({ showToast }) {
  const [query, setQuery] = useState('')
  const [filterModule, setFilterModule] = useState('All')
  const [filterDocType, setFilterDocType] = useState('All')
  const [topK, setTopK] = useState(5)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [activeView, setActiveView] = useState('both') // 'chunks' | 'ai' | 'both'

  const runSearch = async (e) => {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setResults(null)
    setAiAnswer('')

    try {
      const filters = {}
      if (filterModule !== 'All') filters.module = filterModule
      if (filterDocType !== 'All') filters.docType = filterDocType

      const res = await searchKnowledge(query, topK, filters)
      setResults(res)

      // Trigger AI answer if chunks found
      if (res.chunks?.length > 0) {
        setAiLoading(true)
        try {
          const aiRes = await fetch('/api/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, chunks: res.chunks }),
          })
          const aiData = await aiRes.json()
          setAiAnswer(aiData.answer || 'No answer generated.')
        } catch (err) {
          setAiAnswer('AI answer unavailable: ' + err.message)
        } finally {
          setAiLoading(false)
        }
      }
    } catch (err) {
      showToast('error', 'Search failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const hasResults = results?.chunks?.length > 0

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="card-glow p-5">
        <h3 className="font-display text-base font-bold text-slate-100 mb-4">Test Knowledge Search</h3>
        <form onSubmit={runSearch}>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input
                className="input pl-10 text-sm"
                placeholder='e.g. "What are the P1 SLA resolution times?" or "SurePath methodology phases"'
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading || !query.trim()}>
              {loading ? <Loader2 size={14} className="spin" /> : <Search size={14} />}
              Search
            </button>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <span>Module:</span>
              <select className="input w-auto text-xs py-1.5" value={filterModule} onChange={e => setFilterModule(e.target.value)}>
                <option value="All">All modules</option>
                {GW_MODULES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <span>Doc type:</span>
              <select className="input w-auto text-xs py-1.5" value={filterDocType} onChange={e => setFilterDocType(e.target.value)}>
                <option value="All">All types</option>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <span>Top:</span>
              <select className="input w-auto text-xs py-1.5" value={topK} onChange={e => setTopK(Number(e.target.value))}>
                {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n} chunks</option>)}
              </select>
            </div>

            {hasResults && (
              <div className="ml-auto flex gap-1">
                {['both', 'chunks', 'ai'].map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`tab ${activeView === v ? 'active' : ''}`}
                    onClick={() => setActiveView(v)}
                  >
                    {v === 'both' ? 'Split view' : v === 'chunks' ? 'Chunks only' : 'AI answer only'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Empty state */}
      {!results && !loading && (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--indigo-dim)' }}>
            <Search size={24} style={{ color: 'var(--indigo-light)' }} />
          </div>
          <div className="font-display text-lg font-semibold text-slate-100 mb-2">Test your knowledge base</div>
          <div className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Enter a question above to see which chunks would be retrieved and what Claude would answer.
            This validates your ingestion quality.
          </div>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {[
              'What is the P1 incident SLA?',
              'Explain SurePath methodology',
              'How is AMS pricing structured?',
              'What modules are in InsuranceSuite?',
            ].map((q, i) => (
              <button key={i} onClick={() => { setQuery(q); setTimeout(() => runSearch(), 50) }}
                className="text-xs px-3 py-1.5 rounded-lg transition"
                style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)'; e.currentTarget.style.color = '#A5B4FC' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                → {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card p-10 text-center">
          <Loader2 size={24} className="spin mx-auto mb-3" style={{ color: 'var(--indigo-light)' }} />
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Embedding query and searching...</div>
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
              {results.chunks?.length ?? 0} chunks retrieved
              {results.searchTime && <span> · {results.searchTime}ms</span>}
            </div>
            {results.chunks?.length === 0 && (
              <span className="badge badge-amber">No matches — try different keywords or upload more documents</span>
            )}
          </div>

          <div className={`grid gap-6 ${activeView === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Chunks column */}
            {(activeView === 'both' || activeView === 'chunks') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} style={{ color: 'var(--indigo-light)' }} />
                  <span className="font-display text-sm font-semibold text-slate-100">Retrieved Chunks</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                    (what the AI sees as context)
                  </span>
                </div>
                {results.chunks?.length === 0 ? (
                  <div className="card p-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    No matching chunks found
                  </div>
                ) : (
                  results.chunks.map((chunk, i) => (
                    <ChunkResult key={chunk.id} chunk={chunk} rank={i + 1} />
                  ))
                )}
              </div>
            )}

            {/* AI answer column */}
            {(activeView === 'both' || activeView === 'ai') && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Bot size={14} style={{ color: '#F43F5E' }} />
                  <span className="font-display text-sm font-semibold text-slate-100">AI Answer</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                    (Claude grounded in retrieved chunks)
                  </span>
                </div>
                <div className="card-glow p-5" style={{ minHeight: 200 }}>
                  {aiLoading ? (
                    <div className="flex items-center gap-3 py-6">
                      <Loader2 size={16} className="spin flex-shrink-0" style={{ color: 'var(--indigo-light)' }} />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Claude is reading the retrieved chunks...
                      </span>
                    </div>
                  ) : aiAnswer ? (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                      {aiAnswer}
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      AI answer will appear here after search
                    </div>
                  )}
                </div>
                {aiAnswer && (
                  <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <Sparkles size={10} style={{ color: 'var(--indigo-light)' }} />
                    Answer grounded in {results.chunks?.length} retrieved chunks · Claude Sonnet
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
