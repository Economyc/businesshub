import { onCall, HttpsError } from 'firebase-functions/v2/https'
import {
  driveClientId,
  driveClientSecret,
  DriveTokenExpiredError,
  DriveScopeError,
} from './services/drive-oauth.js'
import { assertCompanyMember } from './utils/company-access.js'
import { regenerateInvoiceSheet } from './invoice-sheet/regenerate.js'

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
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 120, secrets: SECRETS },
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

    try {
      const result = await regenerateInvoiceSheet(data.companyId, data.year, data.monthIndex)
      if ('skipped' in result) {
        throw new HttpsError('failed-precondition', messageForReason(result.reason))
      }
      return result
    } catch (err) {
      if (err instanceof HttpsError) throw err
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
    }
  },
)
