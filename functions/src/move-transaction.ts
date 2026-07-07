// Mueve una factura pendiente de una empresa a otra: reubica el doc en
// Firestore (companies/A/transactions → companies/B/transactions), reubica
// físicamente los archivos en Google Drive a las carpetas de la empresa destino
// y regenera de inmediato la hoja contable de AMBAS empresas.
//
// Orden de operaciones (defensivo — la tx original no se borra hasta el final):
//  1. Validar auth + membresía en AMBAS empresas + existencia de la tx.
//  2. Guardas: solo facturas pendientes; bloquear grupos multi-local
//     (splitGroupId/interLocalGroupId) y tx generadas (recurring/closing).
//  3. Validar que la empresa destino tenga Drive configurado y conectado
//     ANTES de tocar nada (si hay adjuntos que mover).
//  4. Mover los archivos en Drive a la estructura {root destino}/{Año}/{Mes}/…
//     Si algún move falla con Drive caído/sin permisos, aborta sin tocar
//     Firestore — la factura permanece intacta en la empresa origen.
//  5. Escribir la tx en la empresa destino (con las refs de archivo quizá
//     nuevas) y borrar la de origen, en un batch.
//  6. Regenerar la hoja de origen y destino al instante + bajar dirty=false de
//     ambos sheet-jobs. Si Drive falla, sheetWarning y el cron las retoma.

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import type { Timestamp } from 'firebase-admin/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firestore.js'
import {
  resolveDriveUid,
  getUserDriveAuth,
  moveDriveFile,
  ensureFolderPath,
  driveClientId,
  driveClientSecret,
  DriveTokenExpiredError,
  DriveScopeError,
} from './services/drive-oauth.js'
import { assertCompanyMember } from './utils/company-access.js'
import {
  monthFolderName,
  looseSubfolderFor,
  SUBFOLDER_LOOSE,
  SUBFOLDER_CONSOLIDATED,
  type DocType,
} from './utils/doc-naming.js'
import { regenerateInvoiceSheet } from './invoice-sheet/regenerate.js'
import { currentYm, ymKey } from './invoice-sheet/month.js'

interface PayableFileLike {
  driveFileId: string
  driveWebViewLink: string
  fileName: string
  mimeType?: string
  uploadedAt?: Timestamp
}

interface TxLike {
  status?: 'paid' | 'pending' | 'overdue' | 'partial'
  documentKind?: 'invoice' | 'purchase'
  date?: Timestamp
  sourceDocument?: PayableFileLike
  paymentProof?: PayableFileLike
  combinedDocument?: PayableFileLike
  splitGroupId?: string
  interLocalGroupId?: string
  sourceType?: 'closing' | 'recurring'
  [key: string]: unknown
}

interface Input {
  fromCompanyId: string
  transactionId: string
  toCompanyId: string
}

interface MoveResult {
  newTransactionId: string | null
  movedFiles: number
  attemptedFiles: number
  sheetOriginRegenerated: boolean
  sheetTargetRegenerated: boolean
  sheetWarning: string | null
  alreadyMoved: boolean
}

const SECRETS = [driveClientId, driveClientSecret]

// Slot de archivo a mover, con la subcarpeta destino que le corresponde dentro
// del árbol Año/Mes de la empresa destino.
type FileSlot = 'sourceDocument' | 'paymentProof' | 'combinedDocument'

function segmentsForSlot(slot: FileSlot, tx: TxLike, year: string, month: string): string[] {
  if (slot === 'combinedDocument') {
    return [year, month, SUBFOLDER_CONSOLIDATED]
  }
  // sourceDocument: 'Factura' o 'Compra' según el tipo; paymentProof: 'Pago'.
  const docType: DocType =
    slot === 'paymentProof' ? 'Pago' : tx.documentKind === 'purchase' ? 'Compra' : 'Factura'
  return [year, month, SUBFOLDER_LOOSE, looseSubfolderFor(docType)]
}

export const moveInvoiceToCompany = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 300, secrets: SECRETS },
  async (request): Promise<MoveResult> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login requerido')
    }
    const data = request.data as Input
    const fromCompanyId = typeof data?.fromCompanyId === 'string' ? data.fromCompanyId.trim() : ''
    const toCompanyId = typeof data?.toCompanyId === 'string' ? data.toCompanyId.trim() : ''
    const transactionId = typeof data?.transactionId === 'string' ? data.transactionId.trim() : ''
    if (!fromCompanyId) throw new HttpsError('invalid-argument', 'fromCompanyId requerido')
    if (!toCompanyId) throw new HttpsError('invalid-argument', 'toCompanyId requerido')
    if (!transactionId) throw new HttpsError('invalid-argument', 'transactionId requerido')
    if (fromCompanyId === toCompanyId) {
      throw new HttpsError('invalid-argument', 'La empresa origen y destino son la misma')
    }

    const uid = request.auth.uid
    // Debe pertenecer a AMBAS empresas para mover entre ellas.
    await assertCompanyMember(uid, fromCompanyId)
    await assertCompanyMember(uid, toCompanyId)

    console.log('[moveInvoiceToCompany] start', { fromCompanyId, toCompanyId, transactionId, uid })

    const fromRef = db
      .collection('companies')
      .doc(fromCompanyId)
      .collection('transactions')
      .doc(transactionId)
    const snap = await fromRef.get()

    // Idempotencia: si ya no está en origen (reintento / doble click) devolvemos
    // éxito con alreadyMoved=true en vez de un 404.
    if (!snap.exists) {
      console.log('[moveInvoiceToCompany] already moved / not found', { fromCompanyId, transactionId })
      return {
        newTransactionId: null,
        movedFiles: 0,
        attemptedFiles: 0,
        sheetOriginRegenerated: false,
        sheetTargetRegenerated: false,
        sheetWarning: null,
        alreadyMoved: true,
      }
    }
    const tx = snap.data() as TxLike

    // ── Guardas ──────────────────────────────────────────────────────────
    if (tx.documentKind !== 'invoice') {
      throw new HttpsError('failed-precondition', 'Solo se pueden mover facturas (cuentas por pagar a crédito).')
    }
    if (!(tx.status === 'pending' || tx.status === 'overdue' || tx.status === 'partial')) {
      throw new HttpsError('failed-precondition', 'Solo se pueden mover facturas pendientes, no las ya pagadas.')
    }
    if (tx.splitGroupId) {
      throw new HttpsError(
        'failed-precondition',
        'Esta factura es parte de un gasto compartido entre locales. No se puede mover suelta.',
      )
    }
    if (tx.interLocalGroupId) {
      throw new HttpsError(
        'failed-precondition',
        'Esta factura es parte de un préstamo entre locales. No se puede mover suelta.',
      )
    }
    if (tx.sourceType === 'recurring' || tx.sourceType === 'closing') {
      throw new HttpsError(
        'failed-precondition',
        'Esta factura la generó un proceso automático (recurrente o cierre) y no se puede mover.',
      )
    }

    // ── Resolver Drive de destino ────────────────────────────────────────
    const toCompanySnap = await db.collection('companies').doc(toCompanyId).get()
    const toCompany = toCompanySnap.data() as { driveRootFolderId?: string } | undefined
    const toRoot = toCompany?.driveRootFolderId

    // Archivos a mover (los que existan).
    const slots: FileSlot[] = ['sourceDocument', 'paymentProof', 'combinedDocument']
    const filesToMove = slots.filter((s) => {
      const f = tx[s] as PayableFileLike | undefined
      return !!f?.driveFileId
    })

    let driveUidFrom = ''
    let driveUidTo = ''
    if (filesToMove.length > 0) {
      if (!toRoot) {
        throw new HttpsError(
          'failed-precondition',
          'La empresa destino no tiene Drive configurado. Conéctalo en Ajustes → Compañías antes de mover facturas con archivos.',
        )
      }
      driveUidTo = await resolveDriveUid(toCompanyId, uid)
      const toAuth = await getUserDriveAuth(driveUidTo)
      if (!toAuth?.refreshToken) {
        throw new HttpsError(
          'failed-precondition',
          'El Drive de la empresa destino no está conectado. El propietario debe conectarlo en Ajustes → Compañías.',
        )
      }
      driveUidFrom = await resolveDriveUid(fromCompanyId, uid)
      // Si son cuentas distintas, también necesitamos leer del Drive origen.
      if (driveUidFrom !== driveUidTo) {
        const fromAuth = await getUserDriveAuth(driveUidFrom)
        if (!fromAuth?.refreshToken) {
          throw new HttpsError(
            'failed-precondition',
            'El Drive de la empresa origen no está conectado, no se pueden recuperar los archivos para moverlos.',
          )
        }
      }
    }

    // ── Mover archivos en Drive (antes de tocar Firestore) ───────────────
    const date = tx.date?.toDate?.() ?? new Date()
    const year = String(date.getFullYear())
    const month = monthFolderName(date.getMonth())

    // Copia de las refs de archivo que persistiremos en destino (se actualizan
    // solo si el move cambió el id/link, es decir cuentas de Drive distintas).
    const updatedFiles: Partial<Record<FileSlot, PayableFileLike>> = {}
    let movedFiles = 0
    try {
      for (const slot of filesToMove) {
        const f = tx[slot] as PayableFileLike
        const targetFolderId = await ensureFolderPath(
          driveUidTo,
          toCompanyId,
          toRoot!,
          segmentsForSlot(slot, tx, year, month),
        )
        const r = await moveDriveFile(driveUidFrom, driveUidTo, f.driveFileId, targetFolderId, f.fileName)
        movedFiles++
        updatedFiles[slot] = {
          ...f,
          driveFileId: r.driveFileId,
          driveWebViewLink: r.webViewLink || f.driveWebViewLink,
          fileName: r.fileName || f.fileName,
        }
      }
    } catch (err) {
      if (err instanceof DriveTokenExpiredError) {
        throw new HttpsError(
          'failed-precondition',
          'El Drive se desconectó (sesión de Google caducada) durante el traslado. La factura NO se movió. El propietario debe reconectar Drive e intentar de nuevo.',
        )
      }
      if (err instanceof DriveScopeError) {
        throw new HttpsError(
          'failed-precondition',
          'La conexión de Drive no tiene el permiso completo. La factura NO se movió. Reconecta marcando TODAS las casillas e intenta de nuevo.',
        )
      }
      console.error('[moveInvoiceToCompany] error moviendo archivo en Drive', err)
      throw new HttpsError('internal', 'No se pudieron mover los archivos en Drive. La factura no se movió; intenta de nuevo.')
    }

    // ── Firestore: crear en destino + borrar de origen (batch) ───────────
    const toRefCol = db.collection('companies').doc(toCompanyId).collection('transactions')
    const newRef = toRefCol.doc()
    const { ...txData } = tx as Record<string, unknown>
    const newData = {
      ...txData,
      ...updatedFiles,
      movedFrom: { companyId: fromCompanyId, at: FieldValue.serverTimestamp() },
      updatedAt: FieldValue.serverTimestamp(),
    }
    const batch = db.batch()
    batch.set(newRef, newData)
    batch.delete(fromRef)
    await batch.commit()

    // ── Regenerar hojas de ambas empresas al instante ────────────────────
    // Facturas pendientes viven en el mes actual de la hoja (igual que en el
    // borrado en cascada).
    const ym = currentYm()
    let sheetOriginRegenerated = false
    let sheetTargetRegenerated = false
    let sheetWarning: string | null = null

    for (const companyId of [fromCompanyId, toCompanyId]) {
      try {
        const result = await regenerateInvoiceSheet(companyId, ym.year, ym.monthIndex)
        if ('skipped' in result) {
          if (result.reason === 'drive-not-connected') {
            sheetWarning = 'Alguna hoja contable no se actualizó al instante (Drive desconectado). El cron la regenerará automáticamente.'
          }
          continue
        }
        if (companyId === fromCompanyId) sheetOriginRegenerated = true
        else sheetTargetRegenerated = true
        // Coordinación con el cron: bajar dirty para no duplicar trabajo.
        await db
          .collection('companies')
          .doc(companyId)
          .collection('sheet-jobs')
          .doc(ymKey(ym.year, ym.monthIndex))
          .set(
            { dirty: false, year: ym.year, monthIndex: ym.monthIndex, processedAt: FieldValue.serverTimestamp() },
            { merge: true },
          )
          .catch((e) => console.warn('[moveInvoiceToCompany] no se pudo bajar dirty del sheet-job', { companyId, e }))
      } catch (err) {
        if (err instanceof DriveTokenExpiredError || err instanceof DriveScopeError) {
          sheetWarning = 'Alguna hoja contable no se actualizó (Drive desconectado o sin permisos). Reconectá Drive — el cron la regenerará.'
        } else {
          sheetWarning = 'Las hojas contables se actualizarán en los próximos minutos.'
          console.warn('[moveInvoiceToCompany] regenerateInvoiceSheet falló — el cron lo retomará', { companyId, err })
        }
      }
    }

    console.log('[moveInvoiceToCompany] done', {
      fromCompanyId,
      toCompanyId,
      newTransactionId: newRef.id,
      movedFiles,
      sheetOriginRegenerated,
      sheetTargetRegenerated,
      sheetWarning,
    })

    return {
      newTransactionId: newRef.id,
      movedFiles,
      attemptedFiles: filesToMove.length,
      sheetOriginRegenerated,
      sheetTargetRegenerated,
      sheetWarning,
      alreadyMoved: false,
    }
  },
)
