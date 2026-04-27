/* eslint-disable no-useless-escape */
// api/chunks.js — Chunk CRUD with pgvector embeddings

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

async function ensureSchema(sql) {
  // Enable pgvector extension
  await sql`CREATE EXTENSION IF NOT EXISTS vector`

  await sql`
    CREATE TABLE IF NOT EXISTS kg_chunks (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      word_count INTEGER,
      char_count INTEGER,
      embedding vector(1536),
      doc_type TEXT,
      modules TEXT[],
      concepts TEXT[],
      summary TEXT,
      domain TEXT,
      is_client_document BOOLEAN DEFAULT FALSE,
      client_name TEXT,
      confidence_score REAL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `

  // Index for fast cosine similarity search
  await sql`
    CREATE INDEX IF NOT EXISTS kg_chunks_embedding_idx
    ON kg_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50)
  `.catch(() => {}) // Ignore if not enough data for IVFFlat yet
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const sql = await getSql()
    await ensureSchema(sql)

    // GET — list chunks for a document
    if (req.method === 'GET') {
      const docId = req.query?.docId
      if (!docId) return res.status(400).json({ error: 'docId required' })

      const rows = await sql`
        SELECT id, doc_id, chunk_index, text, word_count, char_count,
               doc_type, modules, concepts, summary, domain,
               is_client_document, client_name, confidence_score,
               (embedding IS NOT NULL) as embedding,
               created_at
        FROM kg_chunks
        WHERE doc_id = ${docId}
        ORDER BY chunk_index ASC
      `
      return res.status(200).json({ chunks: rows })
    }

    // POST — save a chunk
    if (req.method === 'POST') {
      const { chunk } = await parseBody(req)
      if (!chunk?.id) return res.status(400).json({ error: 'chunk.id required' })

      // Format embedding as pgvector string
      const embeddingVal = chunk.embedding
        ? `[${chunk.embedding.join(',')}]`
        : null

      await sql`
        INSERT INTO kg_chunks (
          id, doc_id, chunk_index, text, word_count, char_count,
          embedding, doc_type, modules, concepts, summary, domain,
          is_client_document, client_name, confidence_score
        ) VALUES (
          ${chunk.id}, ${chunk.docId}, ${chunk.chunkIndex},
          ${chunk.text}, ${chunk.wordCount || 0}, ${chunk.charCount || 0},
          ${embeddingVal}::vector,
          ${chunk.docType || null},
          ${chunk.modules?.length ? sql.array(chunk.modules) : null},
          ${chunk.concepts?.length ? sql.array(chunk.concepts) : null},
          ${chunk.summary || null},
          ${chunk.domain || null},
          ${chunk.isClientDocument || false},
          ${chunk.clientName || null},
          ${chunk.confidenceScore || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          embedding = EXCLUDED.embedding,
          doc_type = EXCLUDED.doc_type,
          modules = EXCLUDED.modules,
          concepts = EXCLUDED.concepts,
          summary = EXCLUDED.summary
      `
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Chunks error:', err)
    return res.status(500).json({ error: err.message })
  }
}
