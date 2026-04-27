/* eslint-disable no-useless-escape */
// api/tag.js — Claude entity extraction, taxonomy inlined

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

function buildPrompt(chunkText, filename, docType) {
  return `You are an expert Guidewire practice knowledge manager at NTT DATA. Analyse this document chunk and extract metadata tags.
Filename: ${filename} | Doc type hint: ${docType || 'Unknown'}
Chunk: ---\n${chunkText.slice(0, 1200)}\n---
Respond ONLY with valid JSON, no markdown:
{"docType":"<SoW|SLA Framework|Runbook|Methodology|Estimation Model|Proposal|Policy|Framework|Technical Spec|Integration Guide|Release Notes|Lessons Learned|Project Report|Training Material|Client Document|Other>","modules":["<PolicyCenter|ClaimCenter|BillingCenter|Digital (Jutro)|DataHub|InfoCenter|Integration Framework|Reinsurance Management|Cloud Platform>"],"concepts":["<up to 8: AMS|SLA|MTTR|P1 Incident|P2 Incident|SurePath|TCV|ACV|FTE|Gosu|OOTB|CI/CD|KT|Sprint|BAU|AMS|Offshore|Nearshore|Onsite|Cloud Migration>"],"domain":"<Guidewire Practice|NTT DATA Internal|Client Document>","summary":"<1-2 sentence summary>","isClientDocument":false,"confidenceScore":0.9}`
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
    const { chunkText, filename, docType } = await parseBody(req)
    if (!chunkText) return res.status(400).json({ error: 'chunkText required' })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: buildPrompt(chunkText, filename || 'unknown', docType) }],
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'Claude API error')

    const text = data.content?.[0]?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    let tags = {}
    try { tags = JSON.parse(clean) } catch { tags = { docType, modules: [], concepts: [], summary: '' } }

    return res.status(200).json({ tags })
  } catch (err) {
    console.error('Tag error:', err)
    return res.status(500).json({ error: err.message })
  }
}
