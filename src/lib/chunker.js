// Text chunking with overlap
// Splits text into chunks of ~chunkSize words with overlapSize word overlap

export function chunkText(text, chunkSize = 450, overlapSize = 60) {
  if (!text || text.trim().length === 0) return []

  // Clean the text
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim()

  const words = cleaned.split(' ')
  if (words.length === 0) return []

  const chunks = []
  let start = 0

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length)
    const chunkWords = words.slice(start, end)
    const chunkText = chunkWords.join(' ').trim()

    if (chunkText.length > 50) { // skip tiny chunks
      chunks.push({
        text: chunkText,
        wordCount: chunkWords.length,
        charCount: chunkText.length,
        startWord: start,
        endWord: end,
      })
    }

    if (end >= words.length) break
    start = end - overlapSize // overlap back
  }

  return chunks
}

// Split text by page markers (for PDF where pages are labelled)
export function splitByPage(text) {
  const pages = text.split(/\f|\[PAGE\s*\d+\]|---PAGE BREAK---/i)
  return pages.map((p, i) => ({ page: i + 1, text: p.trim() })).filter(p => p.text.length > 20)
}

// Estimate token count (rough: ~0.75 tokens per word)
export function estimateTokens(text) {
  return Math.round((text.split(' ').length * 0.75))
}

// Generate a chunk ID
export function chunkId(docId, index) {
  return `${docId}_chunk_${String(index).padStart(4, '0')}`
}
