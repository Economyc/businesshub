import { onCall, HttpsError } from 'firebase-functions/v2/https'
import {
  driveClientId,
  driveClientSecret,
  DriveTokenExpiredError,
  DriveScopeError,
  DriveBudgetExceededError,
} from './services/drive-oauth.js'
import { assertCompanyMember } from './utils/company-access.js'
import { regenerateTransferSheet } from './invoice-sheet/regenerate-transfers.js'
import {
  claimSheetJob,
  releaseSheetJob,
  markSheetJobDirty,
  newLockOwner,
} from './invoice-sheet/sheet-lock.js'

// Genera la hoja de seguimiento de TRASLADOS del mes y la sube a Drive como Google
// Sheet nativo, en {root}/{YYYY}/{MesEs}/Seguimiento/ (junto a la hoja de facturas).
// Un archivo por mes que se reemplaza al regenerar. La generación vive en el
// servidor (regenerateTransferSheet, compartida con el cron de auto-actualización),
// así la hoja manual y la automática nunca divergen.

interface SaveSheetInput {
  companyId: string
  year: number
  monthIndex: number
}

const SECRETS = [driveClientId, driveClientSecret]

// Misma cascada de tiempos que saveInvoiceSheetToDrive (ver ahí el porqué).
// OJO: gcloud IGNORA el `timeoutSeconds` del literal → hay que pasar --timeout=60.
const CALLABLE_BUDGET_MS = 50_000
const CALLABLE_ATTEMPT_TIMEOUT_MS = 20_000

// Traduce el motivo de "skipped" de regenerateTransferSheet a un mensaje accionable.
function messageForReason(reason: string): string {
  switch (reason) {
    case 'company-not-found':
      return 'Empresa no encontrada'
    case 'drive-not-configured':
      return 'La empresa no tiene Drive configurado. Ve a Ajustes y conecta Drive.'
    case 'no-drive-owner':
    case 'drive-not-connected':
      return 'El Drive de la empresa no está conectado. El propietario debe conectarlo en Ajustes → Compañías.'
    case 'no-transfers':
      return 'No hay traslados en este mes para generar la hoja.'
    default:
      return 'No se pudo generar la hoja en Drive.'
  }
}

export const saveTransferSheetToDrive = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 60, secrets: SECRETS },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login requerido')
    }
    const data = request.data as SaveSheetInput
    if (!data?.companyId) throw new HttpsError('invalid-argument', 'companyId requerido')
    if (
      typeof data.year !== 'number' ||
      typeof data.monthIndex !== 'number' ||
      data.monthIndex < 0 ||
      data.monthIndex > 11
    ) {
      throw new HttpsError('invalid-argument', 'year/monthIndex inválidos')
    }

    await assertCompanyMember(request.auth.uid, data.companyId)

    const { companyId, year, monthIndex } = data

    // Lock compartido con la hoja de facturas y con el cron: son archivos
    // distintos, pero resuelven la misma ruta de carpetas con ensureFolderPath y
    // dos findOrCreateFolder concurrentes pueden duplicar carpetas en Drive.
    const claim = await claimSheetJob(companyId, year, monthIndex, newLockOwner('callable-tr'))
    if (!claim.claimed) {
      await markSheetJobDirty(companyId, year, monthIndex)
      return { queued: true as const, reason: 'locked' as const }
    }

    try {
      const result = await regenerateTransferSheet(companyId, year, monthIndex, {
        deadlineAt: Date.now() + CALLABLE_BUDGET_MS,
        attemptTimeoutMs: CALLABLE_ATTEMPT_TIMEOUT_MS,
      })
      if ('skipped' in result) {
        throw new HttpsError('failed-precondition', messageForReason(result.reason))
      }
      return result
    } catch (err) {
      // `skipped` (incl. 'no-transfers') sale por aquí sin re-marcar dirty,
      // igual que hace el cron.
      if (err instanceof HttpsError) throw err

      // Fallo real: el claim limpió `dirty`, hay que reponerlo o el cron no
      // recogería este mes. Ver save-invoice-sheet.ts.
      await markSheetJobDirty(companyId, year, monthIndex).catch(() => {})

      if (err instanceof DriveBudgetExceededError) {
        console.warn(`[save-transfer-sheet] presupuesto agotado en ${companyId}/${year}-${monthIndex + 1}`)
        return { queued: true as const, reason: 'timeout' as const }
      }
      if (err instanceof DriveTokenExpiredError) {
        throw new HttpsError(
          'failed-precondition',
          'El Drive de la empresa se desconectó (la sesión de Google caducó). El propietario debe reconectarlo en Ajustes → Compañías.',
        )
      }
      if (err instanceof DriveScopeError) {
        throw new HttpsError(
          'failed-precondition',
          'Al reconectar Drive no se concedió el permiso completo. El propietario debe volver a Ajustes → Compañías, Desconectar y Conectar Drive, y marcar TODAS las casillas de permiso de Google Drive en la pantalla de Google.',
        )
      }
      throw err
    } finally {
      await releaseSheetJob(claim.ref)
    }
  },
)
