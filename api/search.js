/* eslint-disable no-useless-escape */
// api/search.js — Vector similarity search using pgvector

export const config = { maxDuration: 30 }

async function parseBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  return new Promise((resolve, reject) => {
    let d = ''
    req.on('data', c => { d += c })
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

async function getSql() {
  const { neon } = await import('@neondatabase/serverless')
  const url = process.env.KNOWLEDGE_DATABASE_URL
  if (!url) throw new Error('KNOWLEDGE_DATABASE_URL not configured')
  return neon(url)
}

async function getEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'Embedding failed')
  return data.data[0].embedding
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const startTime = Date.now()

  try {
    const { query, topK = 5, filters = {} } = await parseBody(req)
    if (!query) return res.status(400).json({ error: 'query required' })

    // Embed the query
    const queryEmbedding = await getEmbedding(query)
    const embeddingStr = `[${queryEmbedding.join(',')}]`

    const sql = await getSql()

    // Build filter conditions
    let rows
    if (filters.module && filters.docType) {
      rows = await sql`
        SELECT c.*, d.filename, d.uploaded_by,
               1 - (c.embedding <=> ${embeddingStr}::vector) AS similarity
        FROM kg_chunks c
        JOIN kg_documents d ON c.doc_id = d.id
        WHERE c.embedding IS NOT NULL
          AND ${filters.module} = ANY(c.modules)
          AND c.doc_type = ${filters.docType}
        ORDER BY c.embedding <=> ${embeddingStr}::vector
        LIMIT ${topK}
      `
    } else if (filters.module) {
      rows = await sql`
        SELECT c.*, d.filename, d.uploaded_by,
               1 - (c.embedding <=> ${embeddingStr}::vector) AS similarity
        FROM kg_chunks c
        JOIN kg_documents d ON c.doc_id = d.id
        WHERE c.embedding IS NOT NULL
          AND ${filters.module} = ANY(c.modules)
        ORDER BY c.embedding <=> ${embeddingStr}::vector
        LIMIT ${topK}
      `
    } else if (filters.docType) {
      rows = await sql`
        SELECT c.*, d.filename, d.uploaded_by,
               1 - (c.embedding <=> ${embeddingStr}::vector) AS similarity
        FROM kg_chunks c
        JOIN kg_documents d ON c.doc_id = d.id
        WHERE c.embedding IS NOT NULL
          AND c.doc_type = ${filters.docType}
        ORDER BY c.embedding <=> ${embeddingStr}::vector
        LIMIT ${topK}
      `
    } else {
      rows = await sql`
        SELECT c.*, d.filename, d.uploaded_by,
               1 - (c.embedding <=> ${embeddingStr}::vector) AS similarity
        FROM kg_chunks c
        JOIN kg_documents d ON c.doc_id = d.id
        WHERE c.embedding IS NOT NULL
        ORDER BY c.embedding <=> ${embeddingStr}::vector
        LIMIT ${topK}
      `
    }

    return res.status(200).json({
      chunks: rows,
      query,
      searchTime: Date.now() - startTime,
      totalRetrieved: rows.length,
    })
  } catch (err) {
    console.error('Search error:', err)
    return res.status(500).json({ error: err.message })
  }
}
