// API client — all calls to Vercel serverless functions

const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ── Auth ──────────────────────────────────────────
export async function login(password) {
  return request('/auth', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

// ── Documents ─────────────────────────────────────
export async function listDocuments() {
  return request('/documents')
}

export async function getDocument(docId) {
  return request(`/documents?id=${encodeURIComponent(docId)}`)
}

export async function deleteDocument(docId) {
  return request(`/documents?id=${encodeURIComponent(docId)}`, { method: 'DELETE' })
}

// ── Chunks ────────────────────────────────────────
export async function getChunks(docId) {
  return request(`/chunks?docId=${encodeURIComponent(docId)}`)
}

// ── Ingest pipeline ───────────────────────────────
// Step 1: Save document record
export async function createDocument(doc) {
  return request('/documents', {
    method: 'POST',
    body: JSON.stringify({ doc }),
  })
}

// Step 2: Tag a chunk via Claude
export async function tagChunk(chunkText, filename, docType) {
  return request('/tag', {
    method: 'POST',
    body: JSON.stringify({ chunkText, filename, docType }),
  })
}

// Step 3: Embed a chunk via OpenAI
export async function embedChunk(text) {
  return request('/embed', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

// Step 4: Save a chunk with embedding
export async function saveChunk(chunk) {
  return request('/chunks', {
    method: 'POST',
    body: JSON.stringify({ chunk }),
  })
}

// ── Search ────────────────────────────────────────
export async function searchKnowledge(query, topK = 5, filters = {}) {
  return request('/search', {
    method: 'POST',
    body: JSON.stringify({ query, topK, filters }),
  })
}

// ── Stats ─────────────────────────────────────────
export async function getStats() {
  return request('/stats')
}
