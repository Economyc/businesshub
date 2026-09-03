// Revertir (anular) UN abono de una transacción: borra el doc en la subcolección
// `payments`, recalcula los denormalizados del padre (paidAmount / remainingAmount
// / status / paidDate) re-sumando los abonos restantes, borra en Drive el
// comprobante del abono revertido + el PDF consolidado (que quedó obsoleto) y
// regenera la(s) hoja(s) contable(s) de los meses afectados.
//
// Es el espejo, a nivel de UN abono, del borrado en cascada de una tx entera
// (delete-transaction.ts). Comparte su mismo patrón y helpers.
//
// Orden de operaciones (importante):
//  1. Validar auth + membresía + existencia de tx y del abono (idempotente: si el
//     abono ya no existe, retorna éxito con alreadyReverted:true en vez de error).
//  2. Recalcular los denormalizados re-sumando los abonos restantes (misma lógica
//     que payments-service.registerPayment del cliente). La hoja se reconstruye
//     desde cero desde Firestore, así que dejar la tx consistente + regenerar es
//     suficiente para que la fila del abono desaparezca.
//  3. Validar Drive ANTES de tocar Firestore si hay archivos que borrar (un Drive
//     desconectado debe abortar limpio, no dejar Firestore a medias).
//  4. writeBatch: borra el doc del abono + actualiza los denormalizados de la tx
//     (y espeja al lado recíproco si es un préstamo entre locales).
//  5. Borrar los archivos en Drive (best-effort, se acumulan errores sin abortar).
//  6. Regenerar la(s) hoja(s) del/los mes(es) afectado(s) + bajar dirty=false del
//     sheet-job para no duplicar trabajo del cron.
//
// LÍMITES CONOCIDOS:
//  - NO se regenera el PDF consolidado: se borra el obsoleto y ya. Si quedan
//    abonos, el próximo abono lo reconstruye. Aceptable para "revertir".
//  - En préstamos entre locales se espejan los denormalizados del lado recíproco
//    pero NO se toca su subcolección `payments` (el historial de abonos vive solo
//    en el lado que pagó, igual que registerPayment).

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import type { Timestamp } from 'firebase-admin/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firestore.js'
import {
  resolveDriveUid,
  getUserDriveAuth,
  deleteDriveFile,
  driveClientId,
  driveClientSecret,
  DriveTokenExpiredError,
  DriveScopeError,
} from './services/drive-oauth.js'
import { assertCompanyMember } from './utils/company-access.js'
import { payableOf, statusForPayable } from './utils/withholding.js'
import { regenerateInvoiceSheet } from './invoice-sheet/regenerate.js'
import { bogotaParts, currentYm, ymKey } from './invoice-sheet/month.js'

interface PayableFileLike {
  driveFileId?: string
}

interface PayeeRefLike {
  type?: string
  id?: string
}

interface TxLike {
  amount?: number
  // Retefuente practicada al proveedor: reduce el neto a girar, no el gasto.
  withholdingAmount?: number
  paidDate?: Timestamp
  combinedDocument?: PayableFileLike
  interLocalGroupId?: string
  payeeRef?: PayeeRefLike
}

interface PaymentLike {
  id: string
  amount?: number
  date?: Timestamp
  proof?: PayableFileLike
}

interface Input {
  companyId: string
  transactionId: string
  paymentId: string
}

interface RevertResult {
  deletedFiles: number
  attemptedFiles: number
  monthsRegenerated: { year: number; monthIndex: number }[]
  sheetWarning: string | null
  alreadyReverted: boolean
  driveErrors: string[]
  affected: string[]
}

const SECRETS = [driveClientId, driveClientSecret]

// Estado y saldo van contra el NETO a girar (amount − retefuente), igual que
// payments-service.registerPayment en Ecore. Contra el bruto, revertir un abono
// de una factura con retención dejaría un saldo inflado por la retención — una
// deuda con el proveedor que en realidad se le debe a la DIAN.


// Mes contable (Bogotá) de un Timestamp, o null si no es válido.
function monthOf(ts: Timestamp | undefined): { year: number; monthIndex: number } | null {
  try {
    const d = ts?.toDate?.()
    if (!d) return null
    return bogotaParts(d)
  } catch {
    return null
  }
}

export const revertPaymentWithAttachments = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 300, secrets: SECRETS },
  async (request): Promise<RevertResult> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login requerido')
    }
    const data = request.data as Input
    const companyId = typeof data?.companyId === 'string' ? data.companyId.trim() : ''
    const transactionId = typeof data?.transactionId === 'string' ? data.transactionId.trim() : ''
    const paymentId = typeof data?.paymentId === 'string' ? data.paymentId.trim() : ''
    if (!companyId) throw new HttpsError('invalid-argument', 'companyId requerido')
    if (!transactionId) throw new HttpsError('invalid-argument', 'transactionId requerido')
    if (!paymentId) throw new HttpsError('invalid-argument', 'paymentId requerido')

    await assertCompanyMember(request.auth.uid, companyId)

    console.log('[revertPaymentWithAttachments] start', {
      companyId,
      transactionId,
      paymentId,
      uid: request.auth.uid,
    })

    const txRef = db
      .collection('companies')
      .doc(companyId)
      .collection('transactions')
      .doc(transactionId)
    const snap = await txRef.get()

    // Idempotencia: si la tx ya no existe, no hay nada que revertir.
    if (!snap.exists) {
      console.log('[revertPaymentWithAttachments] tx already deleted', { companyId, transactionId })
      return {
        deletedFiles: 0,
        attemptedFiles: 0,
        monthsRegenerated: [],
        sheetWarning: null,
        alreadyReverted: true,
        driveErrors: [],
        affected: [companyId],
      }
    }
    const tx = snap.data() as TxLike
    const amount = typeof tx.amount === 'number' ? tx.amount : 0
    // Lo que se le gira al proveedor: el bruto menos la retefuente practicada.
    const payable = payableOf(tx)

    // Leer todos los abonos y localizar el que se revierte.
    const paymentsSnap = await txRef.collection('payments').get()
    const payments: PaymentLike[] = paymentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as PaymentLike)
    const reverted = payments.find((p) => p.id === paymentId)

    // Idempotencia: el abono ya no existe (doble click / reintento).
    if (!reverted) {
      console.log('[revertPaymentWithAttachments] payment already reverted', { companyId, transactionId, paymentId })
      return {
        deletedFiles: 0,
        attemptedFiles: 0,
        monthsRegenerated: [],
        sheetWarning: null,
        alreadyReverted: true,
        driveErrors: [],
        affected: [companyId],
      }
    }

    // Recalcular denormalizados re-sumando los abonos restantes.
    const remainingPayments = payments.filter((p) => p.id !== paymentId)
    const newPaid = remainingPayments.reduce((s, p) => s + (typeof p.amount === 'number' ? p.amount : 0), 0)
    const remaining = Math.max(0, payable - newPaid)
    const status = statusForPayable(payable, newPaid)

    // paidDate: si sigue pagada (revertir uno de varios abonos que cubren el total),
    // se ancla al abono restante más reciente; si no, se limpia.
    const latestRemaining = remainingPayments
      .slice()
      .sort((a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0))[0]
    const newPaidDate = status === 'paid' ? (latestRemaining?.date ?? null) : null

    // paymentProof: recomputar al comprobante del abono restante más reciente que
    // tenga uno; si ninguno, se limpia (el DocLink "Comprobante" del detalle).
    const latestProof = remainingPayments
      .slice()
      .sort((a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0))
      .find((p) => p.proof?.driveFileId)?.proof ?? null

    // Lado recíproco de un préstamo entre locales (si aplica). Se resuelve ANTES
    // de armar el batch (get es lectura).
    const affected = [companyId]
    let reciprocalRef: FirebaseFirestore.DocumentReference | null = null
    if (tx.interLocalGroupId && tx.payeeRef?.type === 'company' && tx.payeeRef.id) {
      const counterpartyId = tx.payeeRef.id
      const recipSnap = await db
        .collection('companies')
        .doc(counterpartyId)
        .collection('transactions')
        .where('interLocalGroupId', '==', tx.interLocalGroupId)
        .get()
      const reciprocal = recipSnap.docs.find((d) => d.id !== transactionId)
      if (reciprocal) {
        reciprocalRef = reciprocal.ref
        affected.push(counterpartyId)
      }
    }

    // Archivos a borrar en Drive: comprobante del abono revertido + PDF
    // consolidado (queda obsoleto al cambiar los abonos), deduplicados.
    const fileIds = Array.from(
      new Set(
        [reverted.proof?.driveFileId, tx.combinedDocument?.driveFileId].filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        ),
      ),
    )

    // Validar Drive ANTES de tocar Firestore — un Drive desconectado aborta limpio.
    let driveUid: string | null = null
    if (fileIds.length > 0) {
      driveUid = await resolveDriveUid(companyId, request.auth.uid)
      const userAuth = await getUserDriveAuth(driveUid)
      if (!userAuth?.refreshToken) {
        throw new HttpsError(
          'failed-precondition',
          'El Drive de la empresa no está conectado. El propietario debe reconectarlo en Ajustes → Compañías antes de revertir abonos con adjuntos.',
        )
      }
    }

    // 1) Firestore primero (batch atómico). Si falla, nada se tocó en Drive.
    const batch = db.batch()
    batch.delete(txRef.collection('payments').doc(paymentId))
    batch.update(txRef, {
      paidAmount: newPaid,
      remainingAmount: remaining,
      status,
      paidDate: newPaidDate === null ? FieldValue.delete() : newPaidDate,
      paymentProof: latestProof === null ? FieldValue.delete() : latestProof,
      combinedDocument: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    if (reciprocalRef) {
      batch.update(reciprocalRef, {
        paidAmount: newPaid,
        remainingAmount: remaining,
        status,
        paidDate: newPaidDate === null ? FieldValue.delete() : newPaidDate,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()

    // 2) Drive después (best-effort). Se acumulan errores sin abortar — la data
    // ya quedó consistente en la app; los huérfanos son recuperables a mano.
    const driveErrors: string[] = []
    let deletedFiles = 0
    if (driveUid && fileIds.length > 0) {
      for (const fileId of fileIds) {
        try {
          const r = await deleteDriveFile(driveUid, fileId)
          if (r.deleted || r.notFound) deletedFiles++
        } catch (err) {
          if (err instanceof DriveTokenExpiredError) {
            driveErrors.push(
              'Drive se desconectó (sesión Google caducada). El propietario debe reconectarlo. El abono se revirtió, pero los archivos quedaron en Drive.',
            )
            break
          }
          if (err instanceof DriveScopeError) {
            driveErrors.push(
              'La conexión de Drive no tiene el permiso completo. Reconecta marcando TODAS las casillas. El abono se revirtió, pero los archivos quedaron en Drive.',
            )
            break
          }
          console.error('[revertPaymentWithAttachments] error borrando archivo en Drive', { fileId, err })
          driveErrors.push(`No se pudo eliminar un archivo en Drive (id ${fileId}).`)
        }
      }
    }

    // 3) Regenerar la(s) hoja(s). La tx puede pasar de "Pagadas" (mes de paidDate
    // viejo) a "Pendientes" (mes actual), y el abono sale de "Abonos" (mes del
    // abono). Regeneramos todos esos meses (deduplicados por ymKey).
    const monthCandidates = [monthOf(reverted.date), monthOf(tx.paidDate), currentYm()].filter(
      (m): m is { year: number; monthIndex: number } => m != null,
    )
    const monthsByKey = new Map<string, { year: number; monthIndex: number }>()
    for (const m of monthCandidates) monthsByKey.set(ymKey(m.year, m.monthIndex), m)

    const monthsRegenerated: { year: number; monthIndex: number }[] = []
    let sheetWarning: string | null = null
    for (const m of monthsByKey.values()) {
      try {
        const result = await regenerateInvoiceSheet(companyId, m.year, m.monthIndex)
        if ('skipped' in result) {
          if (result.reason === 'drive-not-connected') {
            sheetWarning =
              'No se pudo actualizar la hoja contable (Drive desconectado). El cron la regenerará automáticamente cuando se reconecte.'
          }
        } else {
          monthsRegenerated.push(m)
          const ym = ymKey(m.year, m.monthIndex)
          await db
            .collection('companies')
            .doc(companyId)
            .collection('sheet-jobs')
            .doc(ym)
            .set(
              {
                dirty: false,
                year: m.year,
                monthIndex: m.monthIndex,
                processedAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            )
            .catch((err) => {
              console.warn('[revertPaymentWithAttachments] no se pudo bajar dirty del sheet-job', err)
            })
        }
      } catch (err) {
        if (err instanceof DriveTokenExpiredError || err instanceof DriveScopeError) {
          sheetWarning =
            'No se pudo actualizar la hoja contable (Drive desconectado o sin permisos). Reconectá Drive — el cron la regenerará automáticamente.'
        } else {
          sheetWarning = 'La hoja contable se actualizará en los próximos minutos.'
          console.warn('[revertPaymentWithAttachments] regenerateInvoiceSheet falló — el cron lo retomará', err)
        }
      }
    }

    console.log('[revertPaymentWithAttachments] done', {
      companyId,
      transactionId,
      paymentId,
      newStatus: status,
      deletedFiles,
      attemptedFiles: fileIds.length,
      monthsRegenerated: monthsRegenerated.length,
      driveErrorsCount: driveErrors.length,
      sheetWarning,
      affected,
    })

    return {
      deletedFiles,
      attemptedFiles: fileIds.length,
      monthsRegenerated,
      sheetWarning,
      alreadyReverted: false,
      driveErrors,
      affected,
    }
  },
)
