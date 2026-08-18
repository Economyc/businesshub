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
  type DriveOpts,
} from '../services/drive-oauth.js'
import { mapLimit } from '../utils/map-limit.js'
import { MESES_ES, monthFolderName, SUBFOLDER_TRACKING } from '../utils/doc-naming.js'
import {
  ACCOUNTING_FIELDS,
  PAYABLE_FIELDS,
  RECEIVABLE_FIELDS,
  INTERLOCAL_FIELDS,
  PAYMENT_FIELDS,
  buildAccountingRows,
  buildPayableRows,
  buildInterLocalRows,
  buildPaymentRows,
  type AdminTx,
  type AdminPayment,
  type ManagedTx,
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
  opts?: DriveOpts,
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

  // 3) Datos: transacciones + suppliers (raíz). Los traslados viven en su propia
  //    hoja (Seguimiento traslados, ver regenerate-transfers.ts), no aquí.
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

  // 3b) Abonos: subcolección payments de las tx gestionadas por Ecore
  //     (paidAmount denormalizado y estado pagado/parcial). Necesario para la
  //     pestaña Abonos.
  const managedTxs = txs.filter(
    (t) => t.paidAmount != null && (t.status === 'paid' || t.status === 'partial'),
  )
  //     Con tope de concurrencia: esto corre dentro de la sección crítica del
  //     lock del mes (sheet-lock.ts), así que abrir un .get() por tx a la vez
  //     alarga la ventana en la que el resto responde `queued`.
  const managed: ManagedTx[] = await mapLimit(managedTxs, 8, async (tx) => {
    const snap = await db
      .collection('companies')
      .doc(companyId)
      .collection('transactions')
      .doc(tx.id)
      .collection('payments')
      .get()
    const payments = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdminPayment)
    return { tx, payments }
  })

  // 4) Pagadas del mes (anclado por paidDate ?? date, hora Bogotá).
  //    interLocal se excluye: sólo aparece en su pestaña (neutralidad F4).
  //    Los turnos extras ('extra', Ecore) entran acá y NO en pestaña aparte: son
  //    gasto pagado del mes y deben sumar en el total que ve el contador; la
  //    columna Tipo ("Extra") permite aislarlos.
  const paid = txs.filter(
    (t) =>
      t.status === 'paid' &&
      !t.interLocalGroupId &&
      (t.documentKind === 'invoice' ||
        t.documentKind === 'purchase' ||
        t.documentKind === 'extra') &&
      inMonthBogota(t.paidDate ?? t.date, year, monthIndex),
  )

  // 5) Pendientes: snapshot de toda la deuda abierta, solo en el mes actual
  const isCurrent = isCurrentMonthBogota(year, monthIndex)
  const pending = isCurrent
    ? txs.filter(
        (t) =>
          t.documentKind === 'invoice' &&
          !t.interLocalGroupId &&
          (t.status === 'pending' || t.status === 'overdue' || t.status === 'partial'),
      )
    : []

  // 5b) Modelo Ecore: deuda abierta por Pagar/Cobrar + entre locales.
  const openStatuses = (t: AdminTx) =>
    t.status === 'pending' || t.status === 'overdue' || t.status === 'partial'
  const payables = txs.filter(
    (t) => t.type === 'expense' && t.documentKind === 'invoice' && !t.interLocalGroupId && openStatuses(t),
  )
  const receivables = txs.filter(
    (t) => t.type === 'income' && t.documentKind === 'receivable' && !t.interLocalGroupId && openStatuses(t),
  )
  const interLocal = txs
    .filter((t) => !!t.interLocalGroupId)
    .sort((a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0))

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

  // 6b) Pestañas del modelo Ecore (se omiten las vacías para no ensuciar la hoja
  //     de empresas que sólo usan App1).
  const pushIf = (name: string, data: Record<string, string | number>[], fields: SheetSpec['fields']) => {
    if (data.length > 0) sheets.push({ name, data, fields })
  }
  pushIf('Por Pagar', buildPayableRows(payables, suppliersById), PAYABLE_FIELDS)
  pushIf('Por Cobrar', buildPayableRows(receivables, suppliersById), RECEIVABLE_FIELDS)
  pushIf('Entre Locales', buildInterLocalRows(interLocal), INTERLOCAL_FIELDS)
  pushIf('Abonos', buildPaymentRows(managed), PAYMENT_FIELDS)

  // 7) Workbook + subida (reemplaza por nombre, convierte a Google Sheet nativo)
  const fileBase64 = await buildWorkbookBase64(sheets)
  const month = MESES_ES[monthIndex]
  const fileName = `Seguimiento facturas - ${month} ${year}`
  const targetFolderId = await ensureFolderPath(
    driveUid,
    companyId,
    driveRootFolderId,
    [String(year), monthFolderName(monthIndex), SUBFOLDER_TRACKING],
    opts,
  )
  const uploaded = await uploadOrReplaceFile(
    driveUid,
    targetFolderId,
    fileName,
    XLSX_MIME,
    fileBase64,
    GOOGLE_SHEET_MIME,
    opts,
  )
  return {
    driveFileId: uploaded.driveFileId,
    webViewLink: uploaded.webViewLink,
    fileName: uploaded.fileName,
  }
}
