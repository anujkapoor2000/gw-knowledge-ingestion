/* eslint-disable no-useless-escape */
// api/parse.js — Server-side document parsing
// Handles PDF (via pdf-parse), Excel (xlsx), Word (mammoth)
// Uses multipart/form-data for file upload

export const config = {
  maxDuration: 60,
  api: { bodyParser: false },
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

// Parse multipart form data manually (no external deps)
async function parseMultipart(req) {
  const contentType = req.headers['content-type'] || ''
  const boundaryMatch = contentType.match(/boundary=(.+)$/)
  if (!boundaryMatch) throw new Error('No boundary in multipart request')
  const boundary = boundaryMatch[1]

  const buf = await streamToBuffer(req)
  const bodyStr = buf.toString('binary')

  const parts = bodyStr.split('--' + boundary).slice(1)
  const files = []

  for (const part of parts) {
    if (part.startsWith('--') || !part.trim()) continue
    const [headerSection, ...bodyParts] = part.split('\r\n\r\n')
    const body = bodyParts.join('\r\n\r\n').replace(/\r\n$/, '')

    const nameMatch = headerSection.match(/name="([^"]+)"/)
    const filenameMatch = headerSection.match(/filename="([^"]+)"/)
    if (!filenameMatch) continue

    files.push({
      fieldname: nameMatch?.[1] || 'file',
      filename: filenameMatch[1],
      data: Buffer.from(body, 'binary'),
    })
  }
  return files
}

// Extract text from Excel buffer
async function parseExcel(buffer) {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'buffer' })
  let text = ''
  let totalRows = 0

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    text += `\n\n=== Sheet: ${sheetName} ===\n`
    for (const row of rows) {
      const rowText = row.filter(c => c !== '').join('\t')
      if (rowText.trim()) {
        text += rowText + '\n'
        totalRows++
      }
    }
  }

  return { text: text.trim(), pageCount: wb.SheetNames.length, metadata: { sheets: wb.SheetNames, rows: totalRows } }
}

// Extract text from Word (docx) buffer
async function parseWord(buffer) {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  const text = result.value || ''
  const paragraphs = text.split('\n').filter(l => l.trim().length > 0).length
  return { text: text.trim(), pageCount: null, metadata: { paragraphs } }
}

// Extract text from PDF buffer
async function parsePDF(buffer) {
  // Use a minimal PDF text extraction without external deps
  // Attempts to extract text streams from PDF binary
  const pdfStr = buffer.toString('binary')

  // Extract text between BT...ET (PDF text blocks)
  const textBlocks = []
  const btEtRegex = /BT([\s\S]*?)ET/g
  let match
  while ((match = btEtRegex.exec(pdfStr)) !== null) {
    const block = match[1]
    // Extract Tj and TJ operators
    const tjRegex = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g
    const tjArrRegex = /\[((?:[^\[\]]|\\.)*)\]\s*TJ/g
    let m2
    while ((m2 = tjRegex.exec(block)) !== null) {
      const decoded = m2[1]
        .replace(/\\n/g, '\n').replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t').replace(/\\\\/g, '\\')
        .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\(.)/g, '$1')
      if (decoded.trim()) textBlocks.push(decoded)
    }
    while ((m2 = tjArrRegex.exec(block)) !== null) {
      const inner = m2[1]
      const strParts = inner.match(/\(([^)]*)\)/g) || []
      const combined = strParts.map(s => s.slice(1, -1)).join('')
      if (combined.trim()) textBlocks.push(combined)
    }
  }

  // Also try to get text from stream objects
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  while ((match = streamRegex.exec(pdfStr)) !== null) {
    const streamContent = match[1]
    if (streamContent.includes('Tj') || streamContent.includes('TJ')) continue // Already processed
    // Look for readable ASCII text sequences
    const readable = streamContent.match(/[\x20-\x7E]{8,}/g) || []
    for (const r of readable) {
      if (r.split(' ').length > 2 && !r.includes('obj') && !r.includes('endobj')) {
        textBlocks.push(r)
      }
    }
  }

  // Count pages
  const pageCount = (pdfStr.match(/\/Type\s*\/Page\b/g) || []).length

  let text = textBlocks.join(' ').replace(/\s+/g, ' ').trim()

  // If extraction got very little, note it
  if (text.length < 100) {
    text = '[Note: Limited text extracted — document may be scanned/image-based. Consider OCR pre-processing.]\n\n' + text
  }

  return { text, pageCount: pageCount || 1, metadata: { method: 'native-extraction' } }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const files = await parseMultipart(req)
    if (files.length === 0) return res.status(400).json({ error: 'No file received' })

    const { filename, data } = files[0]
    const ext = filename.split('.').pop().toLowerCase()

    let result
    if (ext === 'pdf') {
      result = await parsePDF(data)
    } else if (['xlsx', 'xls'].includes(ext)) {
      result = await parseExcel(data)
    } else if (['docx', 'doc'].includes(ext)) {
      result = await parseWord(data)
    } else {
      return res.status(400).json({ error: `Unsupported file type: .${ext}` })
    }

    return res.status(200).json(result)
  } catch (err) {
    console.error('Parse error:', err)
    return res.status(500).json({ error: err.message || 'Parse failed' })
  }
}
