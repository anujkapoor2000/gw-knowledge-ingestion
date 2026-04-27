import { chunkText, chunkId } from './chunker.js'
import { generateDocId } from './utils.js'
import { createDocument, tagChunk, embedChunk, saveChunk } from './apiClient.js'

// Stage names for progress UI
export const STAGES = ['parse', 'chunk', 'tag', 'embed', 'save']

export const STAGE_LABELS = {
  parse: 'Parsing document',
  chunk: 'Chunking text',
  tag: 'Extracting entities',
  embed: 'Generating embeddings',
  save: 'Saving to database',
}

// Parse file content by sending to appropriate serverless parser
async function parseFile(file) {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/parse', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Parse failed: HTTP ${res.status}`)
  }
  const data = await res.json()
  return data // { text, pageCount, metadata }
}

// Main ingestion pipeline for a single file
// onProgress(stage, pct, message) callback for UI updates
export async function ingestFile(file, meta, onProgress) {
  const docId = generateDocId()
  const report = {
    docId,
    filename: file.name,
    chunks: 0,
    errors: [],
    tags: { modules: [], concepts: [], docType: meta.docType },
  }

  try {
    // ── STAGE 1: Parse ────────────────────────────
    onProgress('parse', 5, 'Sending file to parser...')
    const parsed = await parseFile(file)
    const rawText = parsed.text || ''

    if (rawText.trim().length < 50) {
      throw new Error('Extracted text is too short — document may be scanned/image-only or empty')
    }
    onProgress('parse', 20, `Extracted ${rawText.length.toLocaleString()} characters from ${parsed.pageCount || '?'} pages`)

    // ── STAGE 2: Chunk ────────────────────────────
    onProgress('chunk', 25, 'Splitting into chunks...')
    const chunks = chunkText(rawText, 450, 60)
    if (chunks.length === 0) throw new Error('No usable text chunks extracted')
    onProgress('chunk', 35, `Created ${chunks.length} chunks`)

    // ── Create document record ────────────────────
    const docRecord = {
      id: docId,
      filename: file.name,
      fileType: file.name.split('.').pop().toLowerCase(),
      fileSize: file.size,
      docType: meta.docType || 'Other',
      domain: meta.domain || 'Guidewire Practice',
      clientName: meta.clientName || null,
      isClientDocument: meta.isClientDocument || false,
      totalChunks: chunks.length,
      pageCount: parsed.pageCount || null,
      uploadedBy: meta.uploadedBy || 'admin',
      notes: meta.notes || '',
      status: 'processing',
    }
    await createDocument(docRecord)

    // ── STAGE 3: Tag + Embed each chunk ───────────
    const BATCH = 3 // process N chunks in parallel
    let processed = 0
    const totalChunks = chunks.length

    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH)

      await Promise.all(batch.map(async (chunk, batchIdx) => {
        const globalIdx = i + batchIdx
        const cId = chunkId(docId, globalIdx)

        // Tag via Claude
        onProgress('tag', 35 + (globalIdx / totalChunks) * 25,
          `Tagging chunk ${globalIdx + 1}/${totalChunks}...`)

        let tags = { docType: meta.docType, modules: [], concepts: [], summary: '', domain: meta.domain }
        try {
          const tagResult = await tagChunk(chunk.text, file.name, meta.docType)
          if (tagResult.tags) tags = { ...tags, ...tagResult.tags }
        } catch (e) {
          report.errors.push(`Chunk ${globalIdx} tagging failed: ${e.message}`)
        }

        // Embed via OpenAI
        onProgress('embed', 60 + (globalIdx / totalChunks) * 25,
          `Embedding chunk ${globalIdx + 1}/${totalChunks}...`)

        let embedding = null
        try {
          const embedResult = await embedChunk(chunk.text)
          embedding = embedResult.embedding
        } catch (e) {
          report.errors.push(`Chunk ${globalIdx} embedding failed: ${e.message}`)
        }

        // Save chunk
        await saveChunk({
          id: cId,
          docId,
          chunkIndex: globalIdx,
          text: chunk.text,
          wordCount: chunk.wordCount,
          charCount: chunk.charCount,
          embedding,
          // Tags
          docType: tags.docType || meta.docType,
          modules: tags.modules || [],
          concepts: tags.concepts || [],
          summary: tags.summary || '',
          domain: tags.domain || meta.domain,
          isClientDocument: meta.isClientDocument || false,
          clientName: meta.clientName || null,
          confidenceScore: tags.confidenceScore || null,
        })

        // Accumulate tags for report
        if (tags.modules) report.tags.modules = [...new Set([...report.tags.modules, ...tags.modules])]
        if (tags.concepts) report.tags.concepts = [...new Set([...report.tags.concepts, ...tags.concepts])].slice(0, 12)
        if (tags.docType && !report.tags.docType) report.tags.docType = tags.docType

        processed++
      }))

      onProgress('save', 85 + (processed / totalChunks) * 12,
        `Saved ${processed}/${totalChunks} chunks...`)
    }

    // ── Mark doc complete ─────────────────────────
    onProgress('save', 98, 'Finalising document record...')
    await fetch('/api/documents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: docId,
        status: 'ready',
        modules: report.tags.modules,
        concepts: report.tags.concepts,
        docType: report.tags.docType,
      }),
    })

    report.chunks = processed
    onProgress('save', 100, `Done — ${processed} chunks ingested`)
    return { success: true, report }

  } catch (err) {
    report.errors.push(err.message)
    // Mark doc as error if it was created
    try {
      await fetch('/api/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, status: 'error' }),
      })
    } catch {}
    return { success: false, report, error: err.message }
  }
}
