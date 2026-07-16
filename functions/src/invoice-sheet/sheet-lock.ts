// Lock de regeneración de hojas, por (companyId, año, mes).
//
// POR QUÉ EXISTE (bug de prod 2026-07-16): nada serializaba las regeneraciones.
// Cada abono disparaba un saveInvoiceSheetToDrive inmediato desde el cliente Y
// marcaba dirty (markSheetJobDirty) para el cron. Varios abonos seguidos → 3-4
// PATCH concurrentes con conversión xlsx→Google Sheet sobre el MISMO fileId de
// Drive → Drive colgaba >120s (504, que la infra devuelve sin header CORS → el
// navegador lo reportaba como error de CORS) y acababa devolviendo 500
// "Internal Error". Las ejecuciones aisladas siempre funcionaban en 5-12s.
//
// Un ÚNICO lock cubre facturas + traslados aunque sean archivos distintos: ambas
// hojas resuelven la misma ruta con ensureFolderPath, y dos findOrCreateFolder
// concurrentes pueden duplicar carpetas en Drive.
//
// Reusa el doc que ya escribe el trigger: companies/{companyId}/sheet-jobs/{YYYY-MM}.
// Tomar el lock y limpiar el flag `dirty` son LA MISMA escritura atómica, lo que
// conserva el clear-then-process documentado en sheet-jobs-dispatch.ts: si llega
// un write durante la regeneración, el trigger vuelve a marcar dirty y el próximo
// ciclo del cron lo recoge.

import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'
import { db } from '../firestore.js'
import { ymKey } from './month.js'

// Solo para recuperar locks huérfanos (crash / OOM / timeout duro del contenedor,
// donde el `finally` del release no llega a correr). Muy por encima de lo que
// tarda una regeneración sana (5-12s) y del budget del cron (150s).
const LOCK_TTL_MS = 180_000

export type SheetJobClaim =
  | { claimed: true; ref: DocumentReference }
  | { claimed: false }

interface SheetJobDoc {
  lockedUntil?: Timestamp
  lockOwner?: string
}

export function sheetJobRef(
  companyId: string,
  year: number,
  monthIndex: number,
): DocumentReference {
  return db
    .collection('companies')
    .doc(companyId)
    .collection('sheet-jobs')
    .doc(ymKey(year, monthIndex))
}

/** Identifica al titular del lock en los logs. Sin valor funcional. */
export function newLockOwner(tag: string): string {
  return `${tag}:${process.env.K_REVISION ?? 'local'}:${randomUUID().slice(0, 8)}`
}

/**
 * Intenta tomar el lock del mes. Si otro proceso lo tiene, NO escribe nada y
 * devuelve `{claimed:false}` — el caller decide (el callable responde `queued`,
 * el cron se salta el job hasta el próximo ciclo).
 *
 * `{merge:true}` es obligatorio: el callable puede pedir un mes que nunca tuvo
 * doc `sheet-jobs` (generación manual de un mes viejo, sin escrituras).
 */
export async function claimSheetJob(
  companyId: string,
  year: number,
  monthIndex: number,
  owner: string,
): Promise<SheetJobClaim> {
  const ref = sheetJobRef(companyId, year, monthIndex)
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.data() as SheetJobDoc | undefined
    const lockedUntil = data?.lockedUntil?.toMillis?.()
    if (lockedUntil && lockedUntil > Date.now()) return false
    tx.set(
      ref,
      {
        // Clear-then-process: el flag se limpia AL tomar el lock, en la misma
        // escritura atómica.
        dirty: false,
        lockedUntil: Timestamp.fromMillis(Date.now() + LOCK_TTL_MS),
        lockOwner: owner,
        processedAt: FieldValue.serverTimestamp(),
        // year/monthIndex se escriben siempre para que el cron pueda leerlos aunque
        // el doc lo haya creado el callable.
        year,
        monthIndex,
      },
      { merge: true },
    )
    return true
  })
  return claimed ? { claimed: true, ref } : { claimed: false }
}

/**
 * Libera el lock. Va SIEMPRE en un `finally`, y nunca escribe `dirty`: si la
 * regeneración falló y el caller re-marcó dirty para reintentar, el release no
 * debe pisarlo. Si falla, el TTL cubre.
 */
export async function releaseSheetJob(ref: DocumentReference): Promise<void> {
  await ref
    .set(
      { lockedUntil: FieldValue.delete(), lockOwner: FieldValue.delete() },
      { merge: true },
    )
    .catch(() => {
      /* el TTL recupera el lock; no enmascarar el error real del caller */
    })
}

/** Marca el mes como pendiente de regenerar en el próximo ciclo del cron. */
export async function markSheetJobDirty(
  companyId: string,
  year: number,
  monthIndex: number,
): Promise<void> {
  await sheetJobRef(companyId, year, monthIndex).set(
    { dirty: true, year, monthIndex, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
}
