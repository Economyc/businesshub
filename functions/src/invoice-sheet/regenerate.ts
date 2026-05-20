// Generación server-side de la hoja de seguimiento mensual de facturas/pagos y
// subida a Drive como Google Sheet nativo. Única fuente de verdad del contenido
// de la hoja: la usan el callable manual (saveInvoiceSheetToDrive) y el cron de
// auto-actualización (dispatchSheetJobs).
//
// Regla de contenido por mes:
//  - "Pagadas": tx pagadas cuyo (paidDate ?? date) cae en ese mes (hora Bogotá).
//    Registro histórico estable.
//  - "Pendientes": snapshot de TODAS las facturas abiertas, SOLO en el archivo
//    del mes actual. Los meses pasados quedan solo con "Pagadas".
//
// Errores de Drive (token caducado / scope) se RELANZAN: el callable los traduce
// a HttpsError; el dispatch los captura por-job y re-marca dirty para reintento.

import { db, fetchCollection } from '../firestore.js'
import {
  ensureFolderPath,
  uploadOrReplaceFile,
  resolveDriveUid,
  getUserDriveAuth,
} from '../services/drive-oauth.js'
import { MESES_ES } from '../utils/doc-naming.js'
import {
  ACCOUNTING_FIELDS,
  buildAccountingRows,
  type AdminTx,
} from './accounting-rows.js'
import { buildWorkbookBase64, type SheetSpec } from './build-workbook.js'
import { inMonthBogota, isCurrentMonthBogota } from './month.js'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet'

export type RegenerateResult =
  | { driveFileId: string; webViewLink: string; fileName: string }
  | { skipped: true; reason: string }

export async function regenerateInvoiceSheet(
  companyId: string,
  year: number,
  monthIndex: number,
): Promise<RegenerateResult> {
  // 1) Company + Drive configurado
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

  // 3) Datos: transacciones (subcolección) + suppliers (colección raíz)
  const [txsRaw, suppliersRaw] = await Promise.all([
    fetchCollection(companyId, 'transactions'),
    fetchCollection(companyId, 'suppliers'),
  ])
  const txs = txsRaw as unknown as AdminTx[]
  const suppliersById = new Map<string, string>()
  for (const s of suppliersRaw) {
    const id = s.id as string
    if (id) suppliersById.set(id, (s.identification as string) ?? '')
  }

  // 4) Pagadas del mes (anclado por paidDate ?? date, hora Bogotá)
  const paid = txs.filter(
    (t) =>
      t.status === 'paid' &&
      (t.documentKind === 'invoice' || t.documentKind === 'purchase') &&
      inMonthBogota(t.paidDate ?? t.date, year, monthIndex),
  )

  // 5) Pendientes: snapshot de toda la deuda abierta, solo en el mes actual
  const isCurrent = isCurrentMonthBogota(year, monthIndex)
  const pending = isCurrent
    ? txs.filter(
        (t) =>
          t.documentKind === 'invoice' &&
          (t.status === 'pending' || t.status === 'overdue'),
      )
    : []

  // 6) Pestañas (Pendientes primero, solo en el mes actual)
  const sheets: SheetSpec[] = []
  if (isCurrent) {
    sheets.push({
      name: 'Pendientes',
      data: buildAccountingRows(pending, suppliersById),
      fields: ACCOUNTING_FIELDS,
    })
  }
  sheets.push({
    name: 'Pagadas',
    data: buildAccountingRows(paid, suppliersById),
    fields: ACCOUNTING_FIELDS,
  })

  // 7) Workbook + subida (reemplaza por nombre, convierte a Google Sheet nativo)
  const fileBase64 = buildWorkbookBase64(sheets)
  const month = MESES_ES[monthIndex]
  const fileName = `Seguimiento facturas - ${month} ${year}`
  const targetFolderId = await ensureFolderPath(driveUid, companyId, driveRootFolderId, [
    String(year),
    month,
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
