// Trigger Firestore: marca como "sucio" el/los mes(es) cuya hoja de seguimiento
// hay que regenerar cuando cambia una transacción. NO toca Drive (eso es caro);
// solo escribe un flag en companies/{companyId}/sheet-jobs/{YYYY-MM}. El cron
// dispatchSheetJobs hace el trabajo pesado con debounce (una importación de N
// filas colapsa en 1 sola regeneración por mes, gracias al doc-id YYYY-MM).
//
// Se marca el mes del estado ANTES y DESPUÉS del cambio: mover una factura entre
// meses (cambio de paidDate, o pending→paid) debe regenerar ambos archivos.

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

export const markSheetJobDirty = onDocumentWritten(
  { document: 'companies/{companyId}/transactions/{txId}', region: 'us-central1' },
  async (event) => {
    const { companyId } = event.params as { companyId: string }
    const before = event.data?.before?.exists ? (event.data.before.data() as TxLike) : null
    const after = event.data?.after?.exists ? (event.data.after.data() as TxLike) : null

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
  },
)
