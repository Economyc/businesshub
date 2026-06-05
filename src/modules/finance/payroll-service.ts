import { httpsCallable } from 'firebase/functions'
import {
  Timestamp,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db, getAppFunctions } from '@/core/firebase/config'
import { companyCollection } from '@/core/firebase/helpers'
import { queryClient } from '@/core/query/query-client'
import { parseSpreadsheetToText } from '@/modules/agent/utils/parse-spreadsheet'
import type { Employee } from '@/modules/talent/types'
import type { PayableFile } from './types'
import { financeService } from './services'
import type {
  ColillaExtraction,
  PropinasExtraction,
  PayrollAnalyzeResponse,
  EmployeeMatch,
  PayrollRowState,
  TipRowState,
  PayrollBatchLine,
  PayrollBatchDoc,
  TipLine,
  TipDistributionDoc,
  Fortnight,
} from './types-payroll'
import { accrualLabel, accrualTimestamp } from './utils/accrual-period'

const PAYROLL_BATCHES = 'payroll-batches'
const TIP_DISTRIBUTIONS = 'tip-distributions'
const TRANSACTIONS = 'transactions'

// ── Utilidades ──────────────────────────────────────────────────────

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function isSpreadsheet(file: File): boolean {
  const n = file.name.toLowerCase()
  return (
    n.endsWith('.csv') ||
    n.endsWith('.xlsx') ||
    n.endsWith('.xls') ||
    file.type === 'text/csv' ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel')
  )
}

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function onlyDigits(s: string): string {
  return (s || '').replace(/\D/g, '')
}

function nameSimilarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.85
  const ta = new Set(na.split(' ').filter((x) => x.length > 2))
  const tb = new Set(nb.split(' ').filter((x) => x.length > 2))
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / Math.max(ta.size, tb.size)
}

/** Empareja contra empleados: cédula exacta primero, luego similitud de nombre. */
export function matchEmployee(
  employees: Employee[],
  name: string,
  identification?: string,
): EmployeeMatch | null {
  const idDigits = onlyDigits(identification ?? '')
  if (idDigits) {
    const byId = employees.find((e) => onlyDigits(e.identification) === idDigits)
    if (byId) return { id: byId.id, name: byId.name, score: 1 }
  }
  if (!name) return null
  const scored = employees
    .map((e) => ({ id: e.id, name: e.name, score: nameSimilarity(name, e.name) }))
    .sort((x, y) => y.score - x.score)
  if (scored.length > 0 && scored[0].score >= 0.6) return scored[0]
  return null
}

/** Ejecuta `fn` sobre `items` con un límite de concurrencia. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

// ── Extracción IA ───────────────────────────────────────────────────

async function callAnalyze<T>(payload: {
  companyId: string
  kind: 'colilla' | 'propinas'
  fileBase64?: string
  mimeType?: string
  spreadsheetText?: string
}): Promise<PayrollAnalyzeResponse<T>> {
  const fns = await getAppFunctions()
  const analyze = httpsCallable<typeof payload, PayrollAnalyzeResponse<T>>(
    fns,
    'analyzePayrollDocument',
  )
  const res = await analyze(payload)
  return res.data
}

export async function analyzeColilla(
  companyId: string,
  file: File,
): Promise<PayrollAnalyzeResponse<ColillaExtraction>> {
  const fileBase64 = await fileToBase64(file)
  return callAnalyze<ColillaExtraction>({
    companyId,
    kind: 'colilla',
    fileBase64,
    mimeType: file.type || 'application/pdf',
  })
}

export async function analyzePropinas(
  companyId: string,
  file: File,
): Promise<PayrollAnalyzeResponse<PropinasExtraction>> {
  if (isSpreadsheet(file)) {
    const spreadsheetText = await parseSpreadsheetToText(file)
    return callAnalyze<PropinasExtraction>({ companyId, kind: 'propinas', spreadsheetText })
  }
  const fileBase64 = await fileToBase64(file)
  return callAnalyze<PropinasExtraction>({
    companyId,
    kind: 'propinas',
    fileBase64,
    mimeType: file.type || 'application/pdf',
  })
}

// ── Registro (creación de transacciones + resumen) ──────────────────

function invalidateTransactions(companyId: string): void {
  queryClient.invalidateQueries({ queryKey: ['firestore', companyId, TRANSACTIONS] })
  queryClient.invalidateQueries({ queryKey: ['firestore-paginated', companyId, TRANSACTIONS] })
  queryClient.invalidateQueries({ queryKey: ['firestore-count', companyId, TRANSACTIONS] })
}

/** Borra las transacciones de un lote (idempotencia ante reproceso). */
async function deleteBySplitGroup(companyId: string, groupId: string): Promise<void> {
  const ref = companyCollection(companyId, TRANSACTIONS)
  const snap = await getDocs(query(ref, where('splitGroupId', '==', groupId)))
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

async function uploadColillaToDrive(
  companyId: string,
  file: File,
  employeeName: string,
  docNumber: string,
): Promise<PayableFile> {
  const fileBase64 = await fileToBase64(file)
  const fns = await getAppFunctions()
  const upload = httpsCallable<
    {
      companyId: string
      docType: 'Factura' | 'Pago' | 'Compra'
      supplierName: string
      docNumber: string
      date: string
      fileBase64: string
      fileName: string
      mimeType: string
    },
    { driveFileId: string; webViewLink: string; fileName: string }
  >(fns, 'uploadDocumentToDrive')
  const res = await upload({
    companyId,
    docType: 'Compra',
    supplierName: `Nómina ${employeeName}`.trim(),
    // uploadDocumentToDrive exige docNumber no vacío; usamos la cédula (o el
    // periodo como fallback) para que el archivo en Drive sea identificable.
    docNumber: docNumber || 'nomina',
    date: new Date().toISOString().slice(0, 10),
    fileBase64,
    fileName: file.name,
    mimeType: file.type || 'application/pdf',
  })
  return {
    driveFileId: res.data.driveFileId,
    driveWebViewLink: res.data.webViewLink,
    fileName: res.data.fileName,
    mimeType: file.type || 'application/pdf',
    uploadedAt: Timestamp.now(),
  }
}

export interface RegisterPayrollParams {
  /** Mes devengado 'YYYY-MM'. */
  accrualMonth: string
  fortnight: Fortnight
  /** Fecha de pago real (cuándo salió la plata). */
  paidDate: Date
  rows: PayrollRowState[]
}

export interface RegisterPayrollResult {
  registered: number
  failed: { employeeName: string; error: string }[]
}

export async function registerPayrollBatch(
  companyId: string,
  params: RegisterPayrollParams,
): Promise<RegisterPayrollResult> {
  if (!companyId) throw new Error('No hay empresa activa seleccionada.')
  const { accrualMonth, fortnight, paidDate, rows } = params
  // Un único lote por quincena devengada: re-registrar la misma quincena
  // reemplaza al anterior, aunque cambie la fecha de pago.
  const periodKey = `${accrualMonth}_${fortnight}`
  const periodLabel = accrualLabel(accrualMonth, fortnight)
  const groupId = `${companyId}_payroll_${periodKey}`
  const included = rows.filter((r) => r.include && r.employeeId && r.amountToPost > 0)

  // Idempotencia: borrar cualquier registro previo del mismo lote.
  await deleteBySplitGroup(companyId, groupId)

  const dateTs = Timestamp.fromDate(paidDate)
  const accrualTs = accrualTimestamp(accrualMonth, fortnight)
  const lines: PayrollBatchLine[] = []
  const failed: RegisterPayrollResult['failed'] = []

  const settled = await Promise.allSettled(
    included.map(async (row) => {
      const sourceDocument = await uploadColillaToDrive(
        companyId,
        row.file,
        row.employeeName,
        row.extracted.identification || periodKey,
      )
      const txId = await financeService.create(companyId, {
        concept: `Nómina ${row.employeeName} - ${periodLabel}`,
        category: 'Nómina > Salarios',
        amount: row.amountToPost,
        type: 'expense',
        date: dateTs,
        status: 'paid',
        paidDate: dateTs,
        accrualDate: accrualTs,
        payeeRef: { type: 'employee', id: row.employeeId, name: row.employeeName },
        splitGroupId: groupId,
        sourceDocument,
        notes:
          `Periodo ${row.extracted.payPeriod || periodLabel}. ` +
          `Devengado ${row.extracted.totalDevengado}, ` +
          `deducciones ${row.extracted.totalDeducciones}, ` +
          `neto ${row.extracted.netoCancelado}.`,
      })
      const line: PayrollBatchLine = {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        identification: row.extracted.identification,
        totalDevengado: row.extracted.totalDevengado,
        totalDeducciones: row.extracted.totalDeducciones,
        netoCancelado: row.extracted.netoCancelado,
        amountPosted: row.amountToPost,
        transactionId: txId,
        driveFileId: sourceDocument.driveFileId,
        driveWebViewLink: sourceDocument.driveWebViewLink,
      }
      return line
    }),
  )

  settled.forEach((res, i) => {
    if (res.status === 'fulfilled') lines.push(res.value)
    else
      failed.push({
        employeeName: included[i].employeeName,
        error: (res.reason as Error)?.message ?? 'Error desconocido',
      })
  })

  const now = Timestamp.now()
  const summary: PayrollBatchDoc = {
    periodKey,
    periodLabel,
    paidDate: dateTs,
    accrualMonth,
    fortnight,
    lines,
    totalPosted: lines.reduce((s, l) => s + l.amountPosted, 0),
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(doc(db, 'companies', companyId, PAYROLL_BATCHES, `${companyId}_${periodKey}`), summary)

  invalidateTransactions(companyId)
  return { registered: lines.length, failed }
}

export interface RegisterTipsParams {
  /** Mes devengado 'YYYY-MM'. */
  accrualMonth: string
  fortnight: Fortnight
  /** Fecha de pago real (cuándo salió la plata). */
  paidDate: Date
  rows: TipRowState[]
}

export async function registerTipDistribution(
  companyId: string,
  params: RegisterTipsParams,
): Promise<{ total: number }> {
  if (!companyId) throw new Error('No hay empresa activa seleccionada.')
  const { accrualMonth, fortnight, paidDate, rows } = params
  const periodKey = `${accrualMonth}_${fortnight}`
  const periodLabel = accrualLabel(accrualMonth, fortnight)
  const groupId = `${companyId}_tips_${periodKey}`
  const included = rows.filter((r) => r.include && r.amount > 0)
  const total = included.reduce((s, r) => s + r.amount, 0)
  const dateTs = Timestamp.fromDate(paidDate)
  const accrualTs = accrualTimestamp(accrualMonth, fortnight)

  // Idempotencia: reemplazar el gasto previo del mismo lote.
  await deleteBySplitGroup(companyId, groupId)

  let transactionId = ''
  if (total > 0) {
    // Gasto que compensa el ingreso "Propinas" de los cierres → utilidad ≈ 0.
    transactionId = await financeService.create(companyId, {
      concept: `Propinas distribuidas - ${periodLabel}`,
      category: 'Propinas',
      amount: total,
      type: 'expense',
      date: dateTs,
      status: 'paid',
      paidDate: dateTs,
      accrualDate: accrualTs,
      splitGroupId: groupId,
      notes: `Distribución de propinas a ${included.length} empleados.`,
    })
  }

  const now = Timestamp.now()
  const lines: TipLine[] = included.map((r) => ({
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    amount: r.amount,
  }))
  const summary: TipDistributionDoc = {
    periodKey,
    periodLabel,
    paidDate: dateTs,
    accrualMonth,
    fortnight,
    lines,
    total,
    transactionId,
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(
    doc(db, 'companies', companyId, TIP_DISTRIBUTIONS, `${companyId}_${periodKey}`),
    summary,
  )

  invalidateTransactions(companyId)
  return { total }
}
