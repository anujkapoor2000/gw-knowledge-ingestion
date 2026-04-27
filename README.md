# GW Knowledge Ingestion App

Admin tool for loading documents into the NTT DATA Guidewire Practice knowledge base — the ingestion side of a GraphRAG pipeline that powers AI-assisted Q&A across your practice assets.

## What It Does

**Ingestion pipeline per document:**
1. **Parse** — extracts text from PDF, Excel (.xlsx/.xls), Word (.docx/.doc)
2. **Chunk** — splits text into ~450-word chunks with 60-word overlap
3. **Tag** — Claude Haiku auto-extracts: doc type, GW modules, concept tags, per-chunk summary
4. **Embed** — OpenAI `text-embedding-3-small` converts each chunk to a 1536-dim vector
5. **Save** — stores chunks + embeddings in Neon Postgres with pgvector

**Three tabs:**
- **Ingest** — drag-and-drop upload with per-file progress bars showing each pipeline stage
- **Library** — document table with filter/search, chunk preview panel, delete
- **Test Search** — validate ingestion: enter a question, see retrieved chunks + Claude's grounded answer side by side

## Tech Stack

- **Frontend**: Vite + React 18 + Tailwind CSS + Lucide icons
- **Fonts**: Syne (display) + Instrument Sans (body) + DM Mono
- **Backend**: Vercel serverless functions (Node.js)
- **Database**: Neon Postgres with pgvector extension (separate DB from Portfolio Dashboard)
- **Embeddings**: OpenAI `text-embedding-3-small` (1536 dimensions)
- **Tagging**: Claude Haiku (fast + cheap per chunk)
- **RAG answers**: Claude Sonnet (test search Q&A)

## Setup

### 1. Neon Database

Create a **new** Neon project (separate from Portfolio Dashboard) at https://console.neon.tech.

Enable pgvector — run this once in the Neon SQL editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

All tables (`kg_documents`, `kg_chunks`) are auto-created on first API call.

### 2. Environment Variables

Copy `.env.example` to `.env.local` for local dev, or add to Vercel Project Settings:

| Variable | Required | Notes |
|---|---|---|
| `ADMIN_PASSWORD` | ✅ | Shared team password for login gate |
| `KNOWLEDGE_DATABASE_URL` | ✅ | Neon connection string (separate DB) |
| `OPENAI_API_KEY` | ✅ | For `text-embedding-3-small` |
| `ANTHROPIC_API_KEY` | ✅ | For tagging (Haiku) + answers (Sonnet) |

### 3. Install & Run

```bash
npm install
npm run dev        # opens on http://localhost:5174
```

For local API testing with real serverless functions:
```bash
npm install -g vercel
vercel dev         # runs on http://localhost:3000
```

### 4. Deploy to Vercel

```bash
# Push to GitHub, connect in Vercel, add env vars, deploy
git push origin main
```

## File Support

| Format | Parser | Notes |
|---|---|---|
| `.pdf` | Native text extraction | Works for text-based PDFs; scanned/image PDFs need OCR pre-processing |
| `.xlsx`, `.xls` | SheetJS (xlsx) | All sheets extracted; headers preserved |
| `.docx`, `.doc` | Mammoth | Full paragraph and heading extraction |

## Document Taxonomy

Pre-configured tags for the Guidewire domain:

**Doc Types:** SoW, SLA Framework, Runbook, Methodology, Estimation Model, Proposal, Policy, Framework, Technical Spec, Integration Guide, Release Notes, Lessons Learned, Project Report, Training Material, Client Document

**GW Modules:** PolicyCenter, ClaimCenter, BillingCenter, Digital (Jutro), DataHub, InfoCenter, Integration Framework, Reinsurance Management, Cloud Platform

**Concept Tags:** AMS, L1/L2/L3 Support, SLA, MTTR, P1–P4 Incidents, SurePath, TCV, ACV, FTE, Gosu, GWCP, CI/CD, and 40+ more

## Connecting to Portfolio Dashboard

To add knowledge search to your Portfolio Dashboard AI chat, call `/api/search` on this app's domain with the user's query. The endpoint returns the top-K most relevant chunks which you inject into Claude's context window as retrieved evidence.

Example integration in Portfolio Dashboard `api/chat.js`:
```js
// 1. Embed the user query
// 2. Call KNOWLEDGE_APP_URL/api/search with the query
// 3. Inject returned chunks as system context
// 4. Call Claude with enriched context
```

## Cost Estimates

| Operation | Model | Cost per doc (10 pages, ~50 chunks) |
|---|---|---|
| Tagging | Claude Haiku | ~$0.002 |
| Embedding | OpenAI text-embedding-3-small | ~$0.001 |
| **Total per doc** | | **~$0.003** |

A 100-document knowledge base costs roughly **$0.30** to ingest. Search queries cost ~$0.001 each.

## Database Schema

```sql
-- Documents metadata
kg_documents (id, filename, file_type, file_size, doc_type, domain,
              client_name, is_client_document, total_chunks, page_count,
              uploaded_by, notes, status, modules[], concepts[],
              created_at, updated_at)

-- Chunks with vector embeddings
kg_chunks (id, doc_id, chunk_index, text, word_count, char_count,
           embedding vector(1536), doc_type, modules[], concepts[],
           summary, domain, is_client_document, client_name,
           confidence_score, created_at)
```

## Notes

- The login gate uses a shared `ADMIN_PASSWORD` env var — one password for the whole team. For per-user logins, upgrade `api/auth.js` to query a `kg_users` table.
- IVFFlat index on embeddings is created automatically but requires 100+ vectors to be effective. For small corpora, the system falls back to exact search (still fast up to ~50K chunks).
- Re-ingesting a document: delete it from the Library tab, then re-upload. Future version will support in-place re-ingestion.
