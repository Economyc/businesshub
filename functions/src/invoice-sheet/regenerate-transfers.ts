// Generación server-side de la hoja de seguimiento mensual de TRASLADOS (Ecore) y
// subida a Drive como Google Sheet nativo. Hoja dedicada, separada de la de facturas
// (Seguimiento facturas): comparte la misma carpeta de Drive de la empresa
// (driveRootFolderId → {Año}/{Mes}/Seguimiento) pero es un archivo distinto.
//
// Única fuente de verdad del contenido de la hoja de traslados: la usan el callable
// manual (saveTransferSheetToDrive) y el cron de auto-actualización (dispatchSheetJobs).
//
// Errores de Drive (token caducado / scope) se RELANZAN: el callable los traduce a
// HttpsError; el dispatch los captura por-job y re-marca dirty para reintento.

import { db, fetchCollection } from '../firestore.js'
import {
  ensureFolderPath,
  uploadOrReplaceFile,
  resolveDriveUid,
  getUserDriveAuth,
} from '../services/drive-oauth.js'
import { MESES_ES, SUBFOLDER_TRACKING } from '../utils/doc-naming.js'
import {
  TRANSFER_FIELDS,
  buildTransferRows,
  type AdminTransfer,
} from './accounting-rows.js'
import { buildWorkbookBase64, type SheetSpec } from './build-workbook.js'
import { inMonthBogota } from './month.js'
import type { RegenerateResult } from './regenerate.js'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet'

export async function regenerateTransferSheet(
  companyId: string,
  year: number,
  monthIndex: number,
): Promise<RegenerateResult> {
  // 1) Company + Drive configurado (misma carpeta que la hoja de facturas).
  const companySnap = await db.collection('companies').doc(companyId).get()
  if (!companySnap.exists) return { skipped: true, reason: 'company-not-found' }
  const driveRootFolderId = (companySnap.data() as { driveRootFolderId?: string })
    .driveRootFolderId
  if (!driveRootFolderId) return { skipped: true, reason: 'drive-not-configured' }

  // 2) Resolver el uid del Drive de la empresa (sin request.auth → fallback '').
  //    Cortar ANTES de getUserDriveAuth: .doc('') lanza en el Admin SDK.
  const driveUid = await resolveDriveUid(companyId, '')
  if (!driveUid) return { skipped: true, reason: 'no-drive-owner' }
  const userAuth = await getUserDriveAuth(driveUid)
  if (!userAuth?.refreshToken) return { skipped: true, reason: 'drive-not-connected' }

  // 3) Traslados del mes (anclados por date, hora Bogotá).
  const transfersRaw = await fetchCollection(companyId, 'transfers')
  const transfers = transfersRaw as unknown as AdminTransfer[]
  const monthTransfers = transfers.filter((tr) => inMonthBogota(tr.date, year, monthIndex))

  // Sin traslados en el mes: no creamos/reemplazamos una hoja vacía. Esto evita
  // ensuciar el Drive de empresas que sólo usan App1 (sin traslados).
  if (monthTransfers.length === 0) return { skipped: true, reason: 'no-transfers' }

  // 4) Workbook de una sola pestaña + subida (reemplaza por nombre, convierte a Sheet).
  const sheets: SheetSpec[] = [
    { name: 'Traslados', data: buildTransferRows(monthTransfers), fields: TRANSFER_FIELDS },
  ]
  const fileBase64 = await buildWorkbookBase64(sheets)
  const month = MESES_ES[monthIndex]
  const fileName = `Seguimiento traslados - ${month} ${year}`
  const targetFolderId = await ensureFolderPath(driveUid, companyId, driveRootFolderId, [
    String(year),
    month,
    SUBFOLDER_TRACKING,
  ])
  const uploaded = await uploadOrReplaceFile(
    driveUid,
    targetFolderId,
    fileName,
    XLSX_MIME,
    fileBase64,
    GOOGLE_SHEET_MIME,
  )
  return {
    driveFileId: uploaded.driveFileId,
    webViewLink: uploaded.webViewLink,
    fileName: uploaded.fileName,
  }
}
