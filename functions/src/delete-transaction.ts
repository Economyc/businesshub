// Borrado en cascada de una transacción: doc en Firestore + archivos en Drive
// + regeneración inmediata de la hoja contable del mes.
//
// Orden de operaciones (importante):
//  1. Validar auth + membresía + existencia de la tx (idempotente: si ya no
//     existe, retorna éxito con alreadyDeleted:true en vez de error).
//  2. Bloquear borrado de tx vinculadas (splitGroupId / sourceType=recurring)
//     — esos flujos tienen su propio borrado coordinado.
//  3. Borrar el doc en Firestore PRIMERO. Es la operación más barata y la que
//     menos puede fallar; si falla, ningún archivo se tocó y el usuario reintenta
//     limpio. El trigger markSheetJobDirty marca el mes como dirty (safety net).
//  4. Borrar los archivos en Drive (best-effort). Si UNO falla, los siguientes
//     no se intentan y se devuelve el detalle al cliente — los huérfanos
//     resultantes son recuperables manualmente y la tx ya está limpia en la app.
//  5. Regeneración inmediata de la hoja del mes + bajar dirty=false del job para
//     evitar trabajo duplicado del cron. Si la regen falla por Drive (token
//     expirado/scope), se devuelve sheetWarning y el cron lo retomará.

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
import { regenerateInvoiceSheet } from './invoice-sheet/regenerate.js'
import { bogotaParts, currentYm, ymKey } from './invoice-sheet/month.js'

interface PayableFileLike {
  driveFileId?: string
}

interface TxLike {
  status?: 'paid' | 'pending' | 'overdue'
  documentKind?: 'invoice' | 'purchase'
  date?: Timestamp
  paidDate?: Timestamp
  sourceDocument?: PayableFileLike
  paymentProof?: PayableFileLike
  combinedDocument?: PayableFileLike
  splitGroupId?: string
  sourceType?: 'closing' | 'recurring'
}

interface Input {
  companyId: string
  transactionId: string
}

interface DeleteResult {
  deletedFiles: number
  attemptedFiles: number
  monthRegenerated: { year: number; monthIndex: number } | null
  sheetWarning: string | null
  alreadyDeleted: boolean
  driveErrors: string[]
}

const SECRETS = [driveClientId, driveClientSecret]

// Mes contable de esta tx (si aplica al Sheet).
//  - paid invoice/purchase → mes de paidDate ?? date, hora Bogotá.
//  - pending/overdue invoice → mes actual (las pendientes solo viven ahí).
//  - resto → null (no aparece en la hoja).
function monthForTx(tx: TxLike): { year: number; monthIndex: number } | null {
  if (tx.documentKind !== 'invoice' && tx.documentKind !== 'purchase') return null
  if (tx.status === 'paid') {
    try {
      const d = (tx.paidDate ?? tx.date)?.toDate?.()
      if (!d) return null
      return bogotaParts(d)
    } catch {
      return null
    }
  }
  if (tx.documentKind === 'invoice') {
    const ym = currentYm()
    return { year: ym.year, monthIndex: ym.monthIndex }
  }
  return null
}

export const deleteTransactionWithAttachments = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 300, secrets: SECRETS },
  async (request): Promise<DeleteResult> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login requerido')
    }
    const data = request.data as Input
    const companyId = typeof data?.companyId === 'string' ? data.companyId.trim() : ''
    const transactionId = typeof data?.transactionId === 'string' ? data.transactionId.trim() : ''
    if (!companyId) throw new HttpsError('invalid-argument', 'companyId requerido')
    if (!transactionId) throw new HttpsError('invalid-argument', 'transactionId requerido')

    await assertCompanyMember(request.auth.uid, companyId)

    console.log('[deleteTransactionWithAttachments] start', {
      companyId,
      transactionId,
      uid: request.auth.uid,
    })

    const txRef = db
      .collection('companies')
      .doc(companyId)
      .collection('transactions')
      .doc(transactionId)
    const snap = await txRef.get()

    // Idempotencia: si la tx ya no existe (reintento tras timeout, doble click,
    // etc.) devolvemos éxito con alreadyDeleted=true en vez de error 404.
    if (!snap.exists) {
      console.log('[deleteTransactionWithAttachments] already deleted', { companyId, transactionId })
      return {
        deletedFiles: 0,
        attemptedFiles: 0,
        monthRegenerated: null,
        sheetWarning: null,
        alreadyDeleted: true,
        driveErrors: [],
      }
    }
    const tx = snap.data() as TxLike

    // Las tx generadas por recurring o que son parte de un split de nómina
    // tienen su propio borrado coordinado. Permitir borrarlas individualmente
    // dejaría grupos huérfanos.
    if (tx.splitGroupId) {
      throw new HttpsError(
        'failed-precondition',
        'Esta transacción es parte de un gasto compartido entre locales. Bórrala desde el origen (la transacción padre) para que se eliminen todas las partes en bloque.',
      )
    }
    if (tx.sourceType === 'recurring') {
      throw new HttpsError(
        'failed-precondition',
        'Esta transacción fue generada por una regla recurrente. Pausa o elimina la regla para que no se vuelva a generar.',
      )
    }

    // Recolectar IDs de Drive (deduplicados — defensa contra duplicación entre campos).
    const fileIds = Array.from(
      new Set(
        [
          tx.sourceDocument?.driveFileId,
          tx.paymentProof?.driveFileId,
          tx.combinedDocument?.driveFileId,
        ].filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    )

    // Si hay attachments, validar Drive ANTES de tocar Firestore — un Drive
    // desconectado debe abortar limpio, no dejar tx borrada con archivos vivos.
    let driveUid: string | null = null
    if (fileIds.length > 0) {
      driveUid = await resolveDriveUid(companyId, request.auth.uid)
      const userAuth = await getUserDriveAuth(driveUid)
      if (!userAuth?.refreshToken) {
        throw new HttpsError(
          'failed-precondition',
          'El Drive de la empresa no está conectado. El propietario debe reconectarlo en Ajustes → Compañías antes de eliminar transacciones con adjuntos.',
        )
      }
    }

    const monthToRegen = monthForTx(tx)

    // 1) Firestore primero. Si falla, nada se tocó.
    await txRef.delete()

    // 2) Drive después (best-effort). Recolectamos errores para devolverlos al
    // cliente sin abortar — la tx ya está borrada en la app, no podemos
    // "deshacerla" si Drive falla, así que dejamos al cliente decidir qué
    // mostrar al usuario.
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
              'Drive se desconectó (sesión Google caducada). El propietario debe reconectarlo. La transacción se eliminó, pero los archivos quedaron en Drive.',
            )
            break
          }
          if (err instanceof DriveScopeError) {
            driveErrors.push(
              'La conexión de Drive no tiene el permiso completo. Reconecta marcando TODAS las casillas. La transacción se eliminó, pero los archivos quedaron en Drive.',
            )
            break
          }
          console.error('[deleteTransactionWithAttachments] error borrando archivo en Drive', { fileId, err })
          driveErrors.push(`No se pudo eliminar un archivo en Drive (id ${fileId}).`)
        }
      }
    }

    // 3) Regeneración inmediata de la hoja. Si tiene éxito, bajamos dirty=false
    // del sheet-job correspondiente para que el cron no haga trabajo duplicado.
    let monthRegenerated: { year: number; monthIndex: number } | null = null
    let sheetWarning: string | null = null
    if (monthToRegen) {
      try {
        const result = await regenerateInvoiceSheet(companyId, monthToRegen.year, monthToRegen.monthIndex)
        if ('skipped' in result) {
          if (result.reason === 'drive-not-connected') {
            sheetWarning = 'No se pudo actualizar la hoja contable (Drive desconectado). El cron la regenerará automáticamente cuando se reconecte.'
          }
        } else {
          monthRegenerated = monthToRegen
          // Coordinación con el cron: marcar el job como ya procesado para que
          // dispatchSheetJobs no haga trabajo duplicado en su próximo tick.
          const ym = ymKey(monthToRegen.year, monthToRegen.monthIndex)
          await db
            .collection('companies')
            .doc(companyId)
            .collection('sheet-jobs')
            .doc(ym)
            .set(
              {
                dirty: false,
                year: monthToRegen.year,
                monthIndex: monthToRegen.monthIndex,
                processedAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            )
            .catch((err) => {
              // No bloquea — peor caso: el cron regenera otra vez (idempotente).
              console.warn('[deleteTransactionWithAttachments] no se pudo bajar dirty del sheet-job', err)
            })
        }
      } catch (err) {
        if (err instanceof DriveTokenExpiredError || err instanceof DriveScopeError) {
          sheetWarning = 'No se pudo actualizar la hoja contable (Drive desconectado o sin permisos). Reconectá Drive — el cron la regenerará automáticamente.'
        } else {
          sheetWarning = 'La hoja contable se actualizará en los próximos minutos.'
          console.warn('[deleteTransactionWithAttachments] regenerateInvoiceSheet falló — el cron lo retomará', err)
        }
      }
    }

    console.log('[deleteTransactionWithAttachments] done', {
      companyId,
      transactionId,
      deletedFiles,
      attemptedFiles: fileIds.length,
      monthRegenerated,
      driveErrorsCount: driveErrors.length,
      sheetWarning,
    })

    return {
      deletedFiles,
      attemptedFiles: fileIds.length,
      monthRegenerated,
      sheetWarning,
      alreadyDeleted: false,
      driveErrors,
    }
  },
)
