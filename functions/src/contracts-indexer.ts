// Wave 4.1 — Indexer de contratos para RAG.
//
// Trigger Firestore on companies/{companyId}/contracts/{contractId}.
// Cuando un contrato se crea o actualiza, extrae el texto (clauses + metadata),
// chunkea (500 chars / overlap 100), genera embeddings con text-embedding-004
// y guarda en companies/{companyId}/contractEmbeddings/{contractId}/chunks/{chunkId}.
// Si el contrato se borra, limpia todos los chunks.
//
// El shape del contrato usa `clauses: { title, content, order, ... }[]` (ver
// src/modules/contracts/types.ts). Si en el futuro se sube un PDF a Storage,
// extender extractContractText() para descargar y parsear con pdf-parse.

import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { embedMany } from 'ai'
import { db } from './firestore.js'

const CHUNK_SIZE = 500
const CHUNK_OVERLAP = 100
const EMBED_MODEL_ID = 'text-embedding-004'
const EMBED_BATCH = 100

interface RawClause {
  title?: unknown
  content?: unknown
  order?: unknown
}

function getEmbedder() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  const google = createGoogleGenerativeAI({ apiKey })
  return google.textEmbeddingModel(EMBED_MODEL_ID)
}

function extractContractText(data: Record<string, unknown>): string {
  const parts: string[] = []
  const title =
    (typeof data.title === 'string' && data.title) ||
    (typeof data.templateName === 'string' && data.templateName) ||
    ''
  const employeeName = typeof data.employeeName === 'string' ? data.employeeName : ''
  const position = typeof data.position === 'string' ? data.position : ''
  if (title) parts.push(`Contrato: ${title}`)
  if (employeeName) parts.push(`Empleado: ${employeeName}`)
  if (position) parts.push(`Cargo: ${position}`)

  const clauses = Array.isArray(data.clauses) ? (data.clauses as RawClause[]) : []
  const sorted = [...clauses].sort((a, b) => {
    const oa = typeof a.order === 'number' ? a.order : 0
    const ob = typeof b.order === 'number' ? b.order : 0
    return oa - ob
  })
  for (const c of sorted) {
    const t = typeof c.title === 'string' ? c.title : ''
    const body = typeof c.content === 'string' ? c.content : ''
    if (!t && !body) continue
    parts.push(`\n## ${t}\n${body}`.trim())
  }
  return parts.join('\n').trim()
}

export function chunkText(
  text: string,
  size = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
): string[] {
  if (!text) return []
  if (text.length <= size) return [text]
  const out: string[] = []
  const stride = Math.max(1, size - overlap)
  for (let i = 0; i < text.length; i += stride) {
    const slice = text.slice(i, i + size).trim()
    if (slice.length > 0) out.push(slice)
    if (i + size >= text.length) break
  }
  return out
}

async function clearChunks(companyId: string, contractId: string) {
  const ref = db
    .collection('companies')
    .doc(companyId)
    .collection('contractEmbeddings')
    .doc(contractId)
    .collection('chunks')
  const snap = await ref.get()
  if (snap.empty) return
  const batches: FirebaseFirestore.WriteBatch[] = []
  let batch = db.batch()
  let count = 0
  for (const doc of snap.docs) {
    batch.delete(doc.ref)
    count++
    if (count % 400 === 0) {
      batches.push(batch)
      batch = db.batch()
    }
  }
  batches.push(batch)
  await Promise.all(batches.map((b) => b.commit()))
}

export async function indexContract(
  companyId: string,
  contractId: string,
  data: Record<string, unknown>,
): Promise<{ chunks: number }> {
  const text = extractContractText(data)
  await clearChunks(companyId, contractId)
  if (!text) return { chunks: 0 }

  const chunks = chunkText(text)
  if (chunks.length === 0) return { chunks: 0 }

  const embedder = getEmbedder()
  const vectors: number[][] = []
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH)
    const { embeddings } = await embedMany({ model: embedder, values: batch })
    for (const e of embeddings) vectors.push(e)
  }

  const parentRef = db
    .collection('companies')
    .doc(companyId)
    .collection('contractEmbeddings')
    .doc(contractId)

  await parentRef.set(
    {
      contractId,
      contractTitle:
        (typeof data.title === 'string' && data.title) ||
        (typeof data.templateName === 'string' && data.templateName) ||
        null,
      employeeName: typeof data.employeeName === 'string' ? data.employeeName : null,
      chunkCount: chunks.length,
      model: EMBED_MODEL_ID,
      indexedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  let batch = db.batch()
  let writes = 0
  for (let i = 0; i < chunks.length; i++) {
    const id = String(i).padStart(4, '0')
    batch.set(parentRef.collection('chunks').doc(id), {
      chunkIndex: i,
      text: chunks[i],
      embedding: vectors[i],
      contractId,
      createdAt: FieldValue.serverTimestamp(),
    })
    writes++
    if (writes % 400 === 0) {
      await batch.commit()
      batch = db.batch()
    }
  }
  if (writes % 400 !== 0) await batch.commit()

  return { chunks: chunks.length }
}

export const indexContractEmbeddings = onDocumentWritten(
  {
    document: 'companies/{companyId}/contracts/{contractId}',
    region: 'us-central1',
    secrets: ['GEMINI_API_KEY'],
  },
  async (event) => {
    const { companyId, contractId } = event.params as {
      companyId: string
      contractId: string
    }
    try {
      const after = event.data?.after
      if (!after || !after.exists) {
        await clearChunks(companyId, contractId)
        console.log(`[contracts-indexer] cleared ${companyId}/${contractId}`)
        return
      }
      const data = after.data() as Record<string, unknown>
      const result = await indexContract(companyId, contractId, data)
      console.log(
        `[contracts-indexer] indexed ${companyId}/${contractId}: ${result.chunks} chunks`,
      )
    } catch (error) {
      console.error(
        `[contracts-indexer] failed for ${companyId}/${contractId}:`,
        error,
      )
    }
  },
)
