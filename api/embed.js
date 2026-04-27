// api/embed.js — OpenAI text-embedding-3-small

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })

  try {
    const { text } = await parseBody(req)
    if (!text) return res.status(400).json({ error: 'text required' })

    // Truncate to ~8000 tokens max (text-embedding-3-small supports 8191)
    const truncated = text.slice(0, 28000)

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: truncated,
        encoding_format: 'float',
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI API error')

    const embedding = data.data?.[0]?.embedding
    if (!embedding) throw new Error('No embedding returned')

    return res.status(200).json({ embedding, dimensions: embedding.length })
  } catch (err) {
    console.error('Embed error:', err)
    return res.status(500).json({ error: err.message })
  }
}
