/* eslint-disable no-useless-escape */
// api/documents.js — Document CRUD with Neon Postgres

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
  await sql`
    CREATE TABLE IF NOT EXISTS kg_documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      file_type TEXT,
      file_size BIGINT,
      doc_type TEXT,
      domain TEXT,
      client_name TEXT,
      is_client_document BOOLEAN DEFAULT FALSE,
      total_chunks INTEGER DEFAULT 0,
      page_count INTEGER,
      uploaded_by TEXT,
      notes TEXT,
      status TEXT DEFAULT 'processing',
      modules TEXT[],
      concepts TEXT[],
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const sql = await getSql()
    await ensureSchema(sql)

    // GET — list all or single doc
    if (req.method === 'GET') {
      const id = req.query?.id
      if (id) {
        const rows = await sql`SELECT * FROM kg_documents WHERE id = ${id} LIMIT 1`
        return res.status(200).json({ document: rows[0] || null })
      }
      const rows = await sql`SELECT * FROM kg_documents ORDER BY created_at DESC`
      return res.status(200).json({ documents: rows })
    }

    // POST — create
    if (req.method === 'POST') {
      const { doc } = await parseBody(req)
      if (!doc?.id) return res.status(400).json({ error: 'doc.id required' })

      await sql`
        INSERT INTO kg_documents (
          id, filename, file_type, file_size, doc_type, domain,
          client_name, is_client_document, total_chunks, page_count,
          uploaded_by, notes, status
        ) VALUES (
          ${doc.id}, ${doc.filename}, ${doc.fileType}, ${doc.fileSize || 0},
          ${doc.docType}, ${doc.domain}, ${doc.clientName || null},
          ${doc.isClientDocument || false}, ${doc.totalChunks || 0},
          ${doc.pageCount || null}, ${doc.uploadedBy || null},
          ${doc.notes || null}, ${doc.status || 'processing'}
        )
        ON CONFLICT (id) DO NOTHING
      `
      return res.status(200).json({ success: true })
    }

    // PATCH — update status / tags after ingestion
    if (req.method === 'PATCH') {
      const body = await parseBody(req)
      const { id, status, modules, concepts, docType } = body
      if (!id) return res.status(400).json({ error: 'id required' })

      await sql`
        UPDATE kg_documents SET
          status = COALESCE(${status}, status),
          modules = COALESCE(${modules ? sql.array(modules) : null}, modules),
          concepts = COALESCE(${concepts ? sql.array(concepts) : null}, concepts),
          doc_type = COALESCE(${docType || null}, doc_type),
          updated_at = NOW()
        WHERE id = ${id}
      `
      return res.status(200).json({ success: true })
    }

    // DELETE — delete doc and its chunks
    if (req.method === 'DELETE') {
      const id = req.query?.id
      if (!id) return res.status(400).json({ error: 'id required' })

      await sql`DELETE FROM kg_chunks WHERE doc_id = ${id}`
      await sql`DELETE FROM kg_documents WHERE id = ${id}`
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Documents error:', err)
    return res.status(500).json({ error: err.message })
  }
}
