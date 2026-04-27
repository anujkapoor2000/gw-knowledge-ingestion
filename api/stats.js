/* eslint-disable no-useless-escape */
// api/stats.js — Portfolio-wide stats for the header StatsBar

export const config = { maxDuration: 15 }

async function getSql() {
  const { neon } = await import('@neondatabase/serverless')
  const url = process.env.KNOWLEDGE_DATABASE_URL
  if (!url) throw new Error('KNOWLEDGE_DATABASE_URL not configured')
  return neon(url)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const sql = await getSql()

    // Check tables exist before querying
    const tables = await sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('kg_documents', 'kg_chunks')
    `
    const tableNames = tables.map(t => t.tablename)

    if (!tableNames.includes('kg_documents')) {
      return res.status(200).json({ totalDocs: 0, totalChunks: 0, embeddedChunks: 0, avgTags: 0 })
    }

    const [docStats] = await sql`SELECT COUNT(*) as total FROM kg_documents WHERE status = 'ready'`
    const [chunkStats] = await sql`SELECT COUNT(*) as total FROM kg_chunks`
    const [embeddedStats] = await sql`SELECT COUNT(*) as total FROM kg_chunks WHERE embedding IS NOT NULL`
    const [tagStats] = await sql`
      SELECT ROUND(AVG(array_length(concepts, 1) + array_length(modules, 1)), 1) as avg
      FROM kg_chunks
      WHERE concepts IS NOT NULL AND modules IS NOT NULL
    `

    return res.status(200).json({
      totalDocs: parseInt(docStats?.total || 0),
      totalChunks: parseInt(chunkStats?.total || 0),
      embeddedChunks: parseInt(embeddedStats?.total || 0),
      avgTags: tagStats?.avg || 0,
    })
  } catch (err) {
    console.error('Stats error:', err)
    // Return zeros rather than error — stats are non-critical
    return res.status(200).json({ totalDocs: 0, totalChunks: 0, embeddedChunks: 0, avgTags: 0 })
  }
}
