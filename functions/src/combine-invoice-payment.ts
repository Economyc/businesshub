import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { db } from './firestore.js'
import {
  ensureFolderPath,
  uploadFile,
  downloadFile,
  resolveDriveUid,
  getUserDriveAuth,
  driveClientId,
  driveClientSecret,
  DriveTokenExpiredError,
  DriveScopeError,
} from './services/drive-oauth.js'
import { assertCompanyMember } from './utils/company-access.js'
import { buildDocLocation, parseDate, SUBFOLDER_CONSOLIDATED, type DocType } from './utils/doc-naming.js'
import { buildCombinedPdf } from './utils/build-combined-pdf.js'

// Genera el PDF consolidado para la contadora y lo sube a
// {root}/{YYYY}/{MesEs}/PDFs consolidados. Modos:
//   - Factura + comprobante(s): combina factura + 1..N comprobantes en un PDF.
//     `proofFileId` (singular, compat) o `proofFileIds` (N abonos). Si se pasan
//     `payments`, antepone una carátula-resumen (fecha, monto, % acumulado, saldo).
//     Nombre: "{Proveedor} - Factura+Pago {docNumber} - {Mes DD YYYY}.pdf"
//   - Compra de contado (sin comprobantes, docType 'Compra'): envuelve el único
//     documento como PDF, porque ya es un documento final.
//     Nombre: "{Proveedor} - Compra {docNumber} - {Mes DD YYYY}.pdf"
// No borra los originales — el consolidado queda como archivo adicional.

interface CombineInput {
  companyId: string
  sourceFileId: string
  // Comprobantes: `proofFileId` singular (compat App1) o `proofFileIds` (N abonos).
  proofFileId?: string
  proofFileIds?: string[]
  supplierName: string
  docNumber: string
  date: string | number
  docType?: DocType
  // Carátula-resumen opcional (un abono por elemento, en orden cronológico).
  payments?: { date: string | number; amount: number }[]
  invoiceTotal?: number
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

const SECRETS = [driveClientId, driveClientSecret]

export const combineInvoicePaymentToDrive = onCall(
  { region: 'us-central1', memory: '1GiB', timeoutSeconds: 120, secrets: SECRETS },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login requerido')
    }
    const data = request.data as CombineInput
    if (!data?.companyId) throw new HttpsError('invalid-argument', 'companyId requerido')
    if (!data.sourceFileId) throw new HttpsError('invalid-argument', 'sourceFileId requerido')
    if (!data.supplierName?.trim()) throw new HttpsError('invalid-argument', 'supplierName requerido')
    if (!data.docNumber?.trim()) throw new HttpsError('invalid-argument', 'docNumber requerido')

    await assertCompanyMember(request.auth.uid, data.companyId)

    const companySnap = await db.collection('companies').doc(data.companyId).get()
    if (!companySnap.exists) throw new HttpsError('not-found', 'Empresa no encontrada')
    const company = companySnap.data() as { name?: string; driveRootFolderId?: string }
    if (!company.driveRootFolderId) {
      throw new HttpsError(
        'failed-precondition',
        'La empresa no tiene Drive configurado. Ve a Ajustes y conecta Drive.',
      )
    }

    const driveUid = await resolveDriveUid(data.companyId, request.auth.uid)
    const userAuth = await getUserDriveAuth(driveUid)
    if (!userAuth?.refreshToken) {
      throw new HttpsError(
        'failed-precondition',
        'El Drive de la empresa no está conectado. El propietario debe conectarlo en Ajustes → Compañías.',
      )
    }

    const date = parseDate(data.date ?? Date.now())
    const docType: DocType = data.docType ?? 'Factura+Pago'
    const { year, month, baseName } = buildDocLocation(data.supplierName, docType, data.docNumber, date)
    const fileName = `${baseName}.pdf`

    // Normaliza comprobantes: acepta el singular (compat App1) o el arreglo.
    const proofIds = (
      data.proofFileIds?.length ? data.proofFileIds : data.proofFileId ? [data.proofFileId] : []
    ).filter((id): id is string => !!id)

    try {
      // Factura primero, comprobantes después (en orden). Sin comprobantes
      // (compra de contado) envolvemos solo el documento fuente como PDF.
      const parts = await Promise.all([
        downloadFile(driveUid, data.sourceFileId),
        ...proofIds.map((id) => downloadFile(driveUid, id)),
      ])

      // Carátula-resumen solo si el cliente pasó los abonos.
      const cover = data.payments?.length
        ? {
            supplierName: data.supplierName,
            docType,
            docNumber: data.docNumber,
            invoiceTotal: data.invoiceTotal,
            payments: data.payments.map((p) => ({
              date: fmtDate(parseDate(p.date)),
              amount: p.amount,
            })),
          }
        : undefined

      const pdf = await buildCombinedPdf(parts, cover)
      const pdfBase64 = pdf.toString('base64')

      const targetFolderId = await ensureFolderPath(driveUid, data.companyId, company.driveRootFolderId, [year, month, SUBFOLDER_CONSOLIDATED])
      const uploaded = await uploadFile(driveUid, targetFolderId, fileName, 'application/pdf', pdfBase64)

      return {
        driveFileId: uploaded.driveFileId,
        webViewLink: uploaded.webViewLink,
        fileName: uploaded.fileName,
      }
    } catch (err) {
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
