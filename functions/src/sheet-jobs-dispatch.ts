// Cron de auto-actualización de la hoja de seguimiento. Cada 10 min lee los
// meses marcados "sucios" por el trigger markSheetJobDirty (collectionGroup
// sheet-jobs con dirty=true) y regenera cada hoja. Esto da el debounce: muchas
// escrituras seguidas (importación masiva) colapsan en una sola regeneración
// por mes.
//
// clear-then-process: se limpia el flag ANTES de regenerar. Si llega un write
// durante la regeneración, el trigger vuelve a marcar dirty y el próximo run lo
// recoge (idempotente vía uploadOrReplaceFile). Si la regeneración falla, se
// re-marca dirty para reintentar.

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firestore.js'
import { driveClientId, driveClientSecret } from './services/drive-oauth.js'
import { regenerateInvoiceSheet } from './invoice-sheet/regenerate.js'

export const dispatchSheetJobs = onSchedule(
  {
    schedule: 'every 10 minutes',
    timeZone: 'America/Bogota',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
    secrets: [driveClientId, driveClientSecret],
    retryCount: 0,
  },
  async () => {
    // Sin .where('dirty'): un query filtrado sobre collection-group exige un
    // índice COLLECTION_GROUP_ASC. Como el volumen de sheet-jobs es diminuto
    // (un puñado de docs-mes por empresa), traemos todos y filtramos en memoria,
    // evitando el índice. Si algún día crece mucho, añadir el índice y volver al
    // query filtrado.
    const snap = await db.collectionGroup('sheet-jobs').get()
    const dirtyDocs = snap.docs.filter(
      (d) => (d.data() as { dirty?: boolean }).dirty === true,
    )
    if (dirtyDocs.length === 0) {
      console.log('[sheet-jobs] nada que regenerar')
      return
    }

    let ok = 0
    let skipped = 0
    let failed = 0
    // Secuencial: companies pueden compartir el mismo Drive (owner) y la API
    // de Drive rate-limitea por usuario. El volumen por ciclo es bajo.
    for (const doc of dirtyDocs) {
      const companyId = doc.ref.parent.parent?.id
      if (!companyId) continue
      const { year, monthIndex } = doc.data() as { year: number; monthIndex: number }
      try {
        // Limpia el flag antes de procesar (ver clear-then-process arriba).
        await doc.ref.set(
          { dirty: false, processedAt: FieldValue.serverTimestamp() },
          { merge: true },
        )
        const result = await regenerateInvoiceSheet(companyId, year, monthIndex)
        if ('skipped' in result) {
          skipped++
          console.log(`[sheet-jobs] ${companyId}/${doc.id} omitido: ${result.reason}`)
        } else {
          ok++
        }
      } catch (err) {
        failed++
        console.error(`[sheet-jobs] ${companyId}/${doc.id} falló:`, err)
        // Re-marca dirty para reintentar en el próximo ciclo.
        await doc.ref
          .set({ dirty: true, lastError: String(err) }, { merge: true })
          .catch(() => {})
      }
    }
    console.log(`[sheet-jobs] regeneradas=${ok} omitidas=${skipped} fallidas=${failed}`)
  },
)
