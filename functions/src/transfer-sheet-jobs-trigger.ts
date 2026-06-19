// Trigger Firestore: marca como "sucio" el/los mes(es) cuya hoja de seguimiento
// hay que regenerar cuando cambia un TRASLADO (Ecore: companies/{id}/transfers).
// Espejo de markSheetJobDirty (sheet-jobs-trigger.ts), pero para la colección de
// traslados: la pestaña "Traslados" y los "Saldos" del sheet dependen de ellos.
//
// A diferencia de las transacciones, un traslado no tiene status/documentKind:
// el único mes que afecta es el de `date`. Se marca el mes ANTES y DESPUÉS por si
// se reubica un traslado a otro mes.
//
// Comparte el bug y el FALLBACK de firebase-functions v2 documentado en
// sheet-jobs-trigger.ts: si `event.data` no viene decodificado, se extrae la ruta
// del documento del buffer crudo y se relee el estado actual de Firestore.

import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { FieldValue, type Timestamp } from 'firebase-admin/firestore'
import { db } from './firestore.js'
import { ymKeyFromTs } from './invoice-sheet/month.js'

interface TransferLike {
  date?: Timestamp
}

// Extrae la ruta `companies/{id}/transfers/{id}` del evento crudo cuando
// firebase-functions no lo decodificó (mismo mecanismo que en transactions).
function extractDocPath(event: unknown): string | null {
  const ev = event as Record<string, unknown>
  const idx: number[] = []
  for (const k of Object.keys(ev)) {
    if (/^\d+$/.test(k)) idx.push(Number(k))
  }
  if (idx.length === 0) return null
  idx.sort((a, b) => a - b)
  const bytes = Buffer.from(idx.map((i) => Number(ev[i]) & 0xff))
  const s = bytes.toString('latin1')
  const m = /companies\/[A-Za-z0-9_-]+\/transfers\/[A-Za-z0-9_-]+/.exec(s)
  return m ? m[0] : null
}

export const markTransferSheetJobDirty = onDocumentWritten(
  {
    document: 'companies/{companyId}/transfers/{transferId}',
    region: 'us-central1',
    // Mismo motivo que markSheetJobDirty: 256 MiB hacía OOM en cold start.
    // OJO: gcloud IGNORA este valor; al desplegar HAY que pasar `--memory=512Mi`.
    memory: '512MiB',
  },
  async (event) => {
    let companyId = (event.params as { companyId?: string } | undefined)?.companyId
    let before = event.data?.before?.exists ? (event.data.before.data() as TransferLike) : null
    let after = event.data?.after?.exists ? (event.data.after.data() as TransferLike) : null

    // Fallback: firebase-functions no decodificó el evento.
    if (!event.data) {
      const path = extractDocPath(event)
      if (!path) {
        console.warn('[markTransferSheetJobDirty] evento no decodificado y sin ruta extraíble')
        return
      }
      companyId = path.split('/')[1]
      const snap = await db.doc(path).get()
      after = snap.exists ? (snap.data() as TransferLike) : null
      before = null // estado previo no disponible en el fallback
    }

    if (!companyId) return

    const months = new Set<string>()
    const beforeYm = ymKeyFromTs(before?.date)
    if (beforeYm) months.add(beforeYm)
    const afterYm = ymKeyFromTs(after?.date)
    if (afterYm) months.add(afterYm)
    if (months.size === 0) return

    const batch = db.batch()
    for (const ym of months) {
      const [y, m] = ym.split('-')
      const ref = db
        .collection('companies')
        .doc(companyId)
        .collection('sheet-jobs')
        .doc(ym)
      batch.set(
        ref,
        {
          dirty: true,
          year: Number(y),
          monthIndex: Number(m) - 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    }
    await batch.commit()
    console.log(
      `[markTransferSheetJobDirty] ${companyId} → ${[...months].join(',')} (${event.data ? 'native' : 'fallback'})`,
    )
  },
)
