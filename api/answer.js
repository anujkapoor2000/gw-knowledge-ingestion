/* eslint-disable no-useless-escape */
// api/answer.js — Claude RAG answer grounded in retrieved chunks

export const config = { maxDuration: 60 }

async function parseBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  return new Promise((resolve, reject) => {
    let d = ''
    req.on('data', c => { d += c })
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  try {
    const { query, chunks } = await parseBody(req)
    if (!query || !chunks?.length) return res.status(400).json({ error: 'query and chunks required' })

    // Build context from chunks
    const context = chunks.map((c, i) =>
      `[Source ${i + 1}: ${c.filename}${c.doc_type ? ` (${c.doc_type})` : ''}]\n${c.text}`
    ).join('\n\n---\n\n')

    const systemPrompt = `You are an expert knowledge assistant for NTT DATA's Guidewire Practice.
Answer the question using ONLY the provided source documents.
Be specific, cite sources by number [1], [2] etc, and stay grounded in the evidence.
If the documents don't contain enough information, say so clearly.
Keep the answer concise (under 250 words) unless detail is explicitly needed.`

    const userMessage = `Question: ${query}

Source documents:
${context}

Answer grounded in the sources above:`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'Claude API error')

    const answer = data.content?.[0]?.text || 'No answer generated'
    return res.status(200).json({ answer, sourcesUsed: chunks.length })
  } catch (err) {
    console.error('Answer error:', err)
    return res.status(500).json({ error: err.message })
  }
}
