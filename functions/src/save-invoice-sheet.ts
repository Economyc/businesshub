import { onCall, HttpsError } from 'firebase-functions/v2/https'
import {
  driveClientId,
  driveClientSecret,
  DriveTokenExpiredError,
  DriveScopeError,
  DriveBudgetExceededError,
} from './services/drive-oauth.js'
import { assertCompanyMember } from './utils/company-access.js'
import { regenerateInvoiceSheet } from './invoice-sheet/regenerate.js'
import {
  claimSheetJob,
  releaseSheetJob,
  markSheetJobDirty,
  newLockOwner,
} from './invoice-sheet/sheet-lock.js'

// Genera la hoja de seguimiento de facturas/pagos del mes y la sube a Drive como
// Google Sheet nativo, en {root}/{YYYY}/{MesEs}/ (junto a los PDFs). Un archivo
// por mes que se reemplaza al regenerar. La generación vive en el servidor
// (regenerateInvoiceSheet, compartida con el cron de auto-actualización), así la
// hoja manual y la automática nunca divergen. La conversión .xlsx → Google Sheet
// usa solo el scope de Drive; NO requiere el scope de Sheets ni reconectar.

interface SaveSheetInput {
  companyId: string
  year: number
  monthIndex: number
}

const SECRETS = [driveClientId, driveClientSecret]

// Cascada de tiempos (bug de prod 2026-07-16): el cliente corta a los 70s
// (default de httpsCallable). El contenedor corta a los 60s, y el presupuesto
// interno a los 50s → siempre respondemos nosotros, nunca la infra. Importa
// porque un 504 de Cloud Run llega SIN header CORS y el navegador lo reporta
// como un error de CORS que no tiene nada que ver.
// OJO: gcloud IGNORA el `timeoutSeconds` del literal → hay que pasar --timeout=60.
const CALLABLE_BUDGET_MS = 50_000
const CALLABLE_ATTEMPT_TIMEOUT_MS = 20_000

// Traduce el motivo de "skipped" de regenerateInvoiceSheet a un mensaje accionable.
function messageForReason(reason: string): string {
  switch (reason) {
    case 'company-not-found':
      return 'Empresa no encontrada'
    case 'drive-not-configured':
      return 'La empresa no tiene Drive configurado. Ve a Ajustes y conecta Drive.'
    case 'no-drive-owner':
    case 'drive-not-connected':
      return 'El Drive de la empresa no está conectado. El propietario debe conectarlo en Ajustes → Compañías.'
    default:
      return 'No se pudo generar la hoja en Drive.'
  }
}

export const saveInvoiceSheetToDrive = onCall(
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

    // Serializar contra el cron y contra otras pestañas/abonos simultáneos: dos
    // PATCH concurrentes sobre el mismo Google Sheet cuelgan a Drive y acaban en
    // 500. Si otro proceso tiene el mes, no tocamos Drive: dejamos el mes sucio
    // y que lo cierre el cron. Ver sheet-lock.ts.
    const claim = await claimSheetJob(companyId, year, monthIndex, newLockOwner('callable'))
    if (!claim.claimed) {
      await markSheetJobDirty(companyId, year, monthIndex)
      return { queued: true as const, reason: 'locked' as const }
    }

    try {
      const result = await regenerateInvoiceSheet(companyId, year, monthIndex, {
        deadlineAt: Date.now() + CALLABLE_BUDGET_MS,
        attemptTimeoutMs: CALLABLE_ATTEMPT_TIMEOUT_MS,
      })
      if ('skipped' in result) {
        throw new HttpsError('failed-precondition', messageForReason(result.reason))
      }
      return result
    } catch (err) {
      // `skipped` (sin Drive configurado, etc.) sale por aquí: no se re-marca
      // dirty, igual que hace el cron — reintentarlo no arreglaría nada.
      if (err instanceof HttpsError) throw err

      // Cualquier fallo real: tomar el lock ya limpió `dirty`, así que hay que
      // volver a marcarlo o el cron no recogería este mes y la actualización se
      // perdería hasta la próxima escritura.
      await markSheetJobDirty(companyId, year, monthIndex).catch(() => {})

      // Drive no respondió a tiempo. No es un fallo del usuario: el mes ya quedó
      // marcado para el cron, así que devolvemos 200 en vez de agotar el
      // contenedor y que la infra devuelva un 504 sin CORS.
      if (err instanceof DriveBudgetExceededError) {
        console.warn(`[save-invoice-sheet] presupuesto agotado en ${companyId}/${year}-${monthIndex + 1}`)
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
