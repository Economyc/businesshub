// Trigger Firestore: marca como "sucio" el/los mes(es) cuya hoja de seguimiento
// hay que regenerar cuando cambia una transacción. NO toca Drive (eso es caro);
// solo escribe un flag en companies/{companyId}/sheet-jobs/{YYYY-MM}. El cron
// dispatchSheetJobs hace el trabajo pesado con debounce (una importación de N
// filas colapsa en 1 sola regeneración por mes, gracias al doc-id YYYY-MM).
//
// Se marca el mes del estado ANTES y DESPUÉS del cambio: mover una factura entre
// meses (cambio de paidDate, o pending→paid) debe regenerar ambos archivos.
//
// BUG firebase-functions v2 (visto en prod 2026-05-25): con este trigger
// desplegado por gcloud, el evento NO se decodifica — el handler recibe el
// protobuf crudo (DocumentEventData) y `event.data`/`event.params` llegan
// vacíos, así que nunca se sabía qué cambió y el flag jamás se escribía
// (latencia ~7 ms, sin commit). Ver issues firebase/firebase-functions #1659,
// #1669. FALLBACK: si `event.data` no viene decodificado, extraemos la ruta del
// documento del buffer crudo y releemos el estado actual de Firestore. Cuando
// firebase-functions decodifique bien (futura versión) se usa la ruta nativa.

import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { FieldValue, type Timestamp } from 'firebase-admin/firestore'
import { db } from './firestore.js'
import { ymKeyFromTs, currentYm } from './invoice-sheet/month.js'

interface TxLike {
  status?: 'paid' | 'pending' | 'overdue'
  documentKind?: 'invoice' | 'purchase'
  date?: Timestamp
  paidDate?: Timestamp
}

// Devuelve el/los YYYY-MM que un estado de la transacción afecta en las hojas.
function monthsForTx(tx: TxLike | null, months: Set<string>): void {
  if (!tx) return
  if (tx.documentKind !== 'invoice' && tx.documentKind !== 'purchase') return
  if (tx.status === 'paid') {
    const ym = ymKeyFromTs(tx.paidDate ?? tx.date)
    if (ym) months.add(ym)
  } else if (tx.status === 'pending' || tx.status === 'overdue') {
    // Las pendientes solo viven en el archivo del mes actual.
    if (tx.documentKind === 'invoice') months.add(currentYm().key)
  }
}

// Extrae la ruta `companies/{id}/transactions/{id}` del evento crudo cuando
// firebase-functions no lo decodificó. El evento llega como bytes (protobuf
// DocumentEventData con claves numéricas 0..N); el `name` del documento es
// texto ASCII dentro del buffer.
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
  const m = /companies\/[A-Za-z0-9_-]+\/transactions\/[A-Za-z0-9_-]+/.exec(s)
  return m ? m[0] : null
}

export const markSheetJobDirty = onDocumentWritten(
  {
    document: 'companies/{companyId}/transactions/{txId}',
    region: 'us-central1',
    // 256 MiB (default) hacía OOM en cold start al cargar firebase-admin (usaba
    // 256-260 MiB) y el contenedor moría ANTES del batch.commit() → el flag dirty
    // nunca se escribía y la hoja nunca se regeneraba (OOM diario desde 2026-05-21).
    // OJO: el deploy con gcloud IGNORA este valor; al redeployar HAY que pasar
    // también `--memory=512Mi`. Este literal solo documenta la intención (y aplica
    // si algún día se migra a `firebase deploy`).
    memory: '512MiB',
  },
  async (event) => {
    let companyId = (event.params as { companyId?: string } | undefined)?.companyId
    let before = event.data?.before?.exists ? (event.data.before.data() as TxLike) : null
    let after = event.data?.after?.exists ? (event.data.after.data() as TxLike) : null

    // Fallback: firebase-functions no decodificó el evento (ver cabecera).
    if (!event.data) {
      const path = extractDocPath(event)
      if (!path) {
        console.warn('[markSheetJobDirty] evento no decodificado y sin ruta extraíble')
        return
      }
      companyId = path.split('/')[1]
      const snap = await db.doc(path).get()
      after = snap.exists ? (snap.data() as TxLike) : null
      before = null // estado previo no disponible en el fallback
    }

    if (!companyId) return

    const months = new Set<string>()
    monthsForTx(before, months)
    monthsForTx(after, months)
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
      `[markSheetJobDirty] ${companyId} → ${[...months].join(',')} (${event.data ? 'native' : 'fallback'})`,
    )
  },
)
