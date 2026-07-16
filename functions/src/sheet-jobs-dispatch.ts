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
//
// El clear-then-process es hoy la misma escritura atómica que tomar el lock del
// mes (claimSheetJob): el cron y los callables manuales comparten ese lock para
// no pisarse sobre el mismo archivo de Drive. Ver sheet-lock.ts.

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { db } from './firestore.js'
import { driveClientId, driveClientSecret, type DriveOpts } from './services/drive-oauth.js'
import { regenerateInvoiceSheet } from './invoice-sheet/regenerate.js'
import { regenerateTransferSheet } from './invoice-sheet/regenerate-transfers.js'
import { claimSheetJob, releaseSheetJob, newLockOwner } from './invoice-sheet/sheet-lock.js'

// Presupuesto por job (facturas + traslados de un mes). Muy por debajo del
// timeout de 540s del contenedor, para que varios meses sucios quepan en un
// ciclo aunque alguno vaya lento.
const JOB_BUDGET_MS = 150_000
const JOB_ATTEMPT_TIMEOUT_MS = 60_000

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

      // Tomar el lock limpia `dirty` en la misma escritura atómica.
      const claim = await claimSheetJob(companyId, year, monthIndex, newLockOwner('cron'))
      if (!claim.claimed) {
        // Un callable manual está regenerando este mes ahora mismo, con datos
        // iguales o más frescos que los de este snapshot. No re-marcamos dirty:
        // si llegan writes durante su regeneración, el trigger lo hará por su
        // cuenta y lo recoge el próximo ciclo.
        skipped++
        console.log(`[sheet-jobs] ${companyId}/${doc.id} lock ocupado, se reintenta luego`)
        continue
      }

      const opts: DriveOpts = {
        deadlineAt: Date.now() + JOB_BUDGET_MS,
        attemptTimeoutMs: JOB_ATTEMPT_TIMEOUT_MS,
      }
      try {
        // Mismo flag dirty para ambas hojas (facturas + traslados). Idempotentes
        // vía uploadOrReplaceFile. La de traslados se omite si el mes no tiene
        // traslados ('no-transfers').
        const result = await regenerateInvoiceSheet(companyId, year, monthIndex, opts)
        if ('skipped' in result) {
          skipped++
          console.log(`[sheet-jobs] ${companyId}/${doc.id} facturas omitido: ${result.reason}`)
        } else {
          ok++
        }
        const trResult = await regenerateTransferSheet(companyId, year, monthIndex, opts)
        if ('skipped' in trResult) {
          skipped++
          console.log(`[sheet-jobs] ${companyId}/${doc.id} traslados omitido: ${trResult.reason}`)
        } else {
          ok++
        }
      } catch (err) {
        failed++
        console.error(`[sheet-jobs] ${companyId}/${doc.id} falló:`, err)
        // Re-marca dirty para reintentar en el próximo ciclo. Va ANTES del
        // release, y releaseSheetJob solo borra los campos del lock, así que no
        // se pisan.
        await doc.ref
          .set({ dirty: true, lastError: String(err) }, { merge: true })
          .catch(() => {})
      } finally {
        await releaseSheetJob(claim.ref)
      }
    }
    console.log(`[sheet-jobs] regeneradas=${ok} omitidas=${skipped} fallidas=${failed}`)
  },
)
