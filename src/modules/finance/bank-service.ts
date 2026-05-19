import {
  Timestamp,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, getAppFunctions } from '@/core/firebase/config'
import { companyCollection } from '@/core/firebase/helpers'
import { queryClient } from '@/core/query/query-client'
import type {
  BankColumnMapping,
  BankMovement,
  BankStatement,
  ParsedBankFile,
  ParsedBankRow,
} from './types-bank'

const BANK_MOVEMENTS = 'bank-movements'
const BANK_STATEMENTS = 'bank-statements'
const TRANSACTIONS = 'transactions'
const SETTINGS = 'settings'
const SETTINGS_BANK_IMPORT = 'bank-import'
const BATCH_LIMIT = 450

// papaparse / xlsx se cargan dinámicamente solo al subir un archivo (mismo
// patrón que parse-spreadsheet.ts) — la vista no paga estas libs en su chunk.
const loadPapa = () => import('papaparse').then((m) => m.default)
const loadXLSX = () => import('xlsx')

// ── Normalización de montos ES-CO ───────────────────────────────────

/**
 * Convierte un monto bancario a número. Tolera formato Colombia
 * ("1.234.567,89", "$ 1.234.567"), formato US ("1,234,567.89"),
 * negativos con signo o entre paréntesis, y celdas que ya son `number`.
 * Devuelve `NaN` si no hay dígitos.
 */
export function parseAmountCO(raw: unknown): number {
  if (typeof raw === 'number') return raw
  let s = String(raw ?? '').trim()
  if (!s) return NaN
  const negative = /^\(.*\)$/.test(s) || /-\s*$/.test(s) || /^\s*-/.test(s)
  // Quitar todo menos dígitos y separadores.
  s = s.replace(/[^\d.,]/g, '')
  if (!s) return NaN

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let normalized: string
  if (lastDot !== -1 && lastComma !== -1) {
    // Ambos presentes: el separador más a la derecha es el decimal.
    const decSep = lastDot > lastComma ? '.' : ','
    const thouSep = decSep === '.' ? ',' : '.'
    normalized = s.split(thouSep).join('').replace(decSep, '.')
  } else if (lastComma !== -1) {
    // Solo coma: en CO la coma es decimal salvo que sea separador de miles
    // (grupos de exactamente 3 dígitos). "1,234,567" → miles; "1234,56" → dec.
    const parts = s.split(',')
    const allThousandGroups =
      parts.length > 1 && parts.slice(1).every((p) => p.length === 3) && parts[0].length <= 3
    normalized = allThousandGroups ? parts.join('') : s.replace(',', '.')
  } else if (lastDot !== -1) {
    // Solo punto: en CO suele ser separador de miles. Lo tratamos como miles
    // salvo que el último grupo NO tenga 3 dígitos (entonces es decimal).
    const parts = s.split('.')
    const looksThousand =
      parts.length > 1 && parts.slice(1).every((p) => p.length === 3) && parts[0].length <= 3
    normalized = looksThousand ? parts.join('') : s
  } else {
    normalized = s
  }

  const n = Number(normalized)
  if (Number.isNaN(n)) return NaN
  return negative ? -Math.abs(n) : n
}

// ── Parseo de fechas ────────────────────────────────────────────────

const MONTHS_ES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
}

/** Devuelve ISO yyyy-mm-dd o '' si no se pudo interpretar. */
export function parseDateFlexible(raw: unknown): string {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return toISO(raw.getFullYear(), raw.getMonth() + 1, raw.getDate())
  }
  if (typeof raw === 'number' && raw > 0) {
    // Serial de Excel (días desde 1899-12-30).
    const ms = Math.round((raw - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (!Number.isNaN(d.getTime())) {
      return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
    }
  }
  const s = String(raw ?? '').trim()
  if (!s) return ''

  // yyyy-mm-dd / yyyy/mm/dd
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s)
  if (m) return toISO(+m[1], +m[2], +m[3])

  // dd/mm/yyyy o dd-mm-yyyy (CO: día primero). yy → 20yy.
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s)
  if (m) {
    let year = +m[3]
    if (year < 100) year += 2000
    const day = +m[1]
    const mon = +m[2]
    // Si el primer grupo > 12 es claramente día; si el segundo > 12 invertir.
    if (mon > 12 && day <= 12) return toISO(year, day, mon)
    return toISO(year, mon, day)
  }

  // "15 ene 2026" / "15-ene-2026" / "15 de enero de 2026"
  m = /^(\d{1,2})\s*(?:de\s+)?[-\s]?([a-záéíóú]{3,})[-\s.]+(?:de\s+)?(\d{4})/i.exec(s)
  if (m) {
    const mon = MONTHS_ES[m[2].slice(0, 3).toLowerCase()]
    if (mon) return toISO(+m[3], mon, +m[1])
  }

  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) {
    return toISO(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate())
  }
  return ''
}

function toISO(y: number, mo: number, d: number): string {
  if (!y || !mo || !d || mo > 12 || d > 31) return ''
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ── Heurística de columnas ──────────────────────────────────────────

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

const PATTERNS = {
  date: /fecha|date|f\.?\s*operac|f\.?\s*transac/,
  description: /descrip|concepto|detalle|transac|movimiento|glosa|observ/,
  reference: /referenc|ref\b|documento|num.*doc|comprobante|autoriz/,
  amount: /valor|importe|monto|amount|movimiento\s*\$/,
  debit: /debito|cargo|retiro|salida|debit/,
  credit: /credito|abono|consign|deposito|entrada|credit/,
  balance: /saldo|balance/,
}

function detectMapping(headers: string[]): BankColumnMapping {
  const find = (re: RegExp): string | null => {
    for (const h of headers) {
      if (h && re.test(norm(h))) return h
    }
    return null
  }
  const debit = find(PATTERNS.debit)
  const credit = find(PATTERNS.credit)
  return {
    date: find(PATTERNS.date),
    description: find(PATTERNS.description),
    reference: find(PATTERNS.reference),
    // Si hay débito/crédito separados, no usamos columna única de monto.
    amount: debit && credit ? null : find(PATTERNS.amount),
    debit,
    credit,
    balance: find(PATTERNS.balance),
  }
}

function headerScore(row: unknown[]): number {
  const cells = row.map((c) => norm(String(c ?? '')))
  let score = 0
  for (const re of Object.values(PATTERNS)) {
    if (cells.some((c) => c && re.test(c))) score += 1
  }
  return score
}

// ── Carga de matriz cruda ───────────────────────────────────────────

async function readMatrix(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    const Papa = await loadPapa()
    const text = await file.text()
    const res = Papa.parse<string[]>(text, { skipEmptyLines: true })
    return res.data
  }
  const XLSX = await loadXLSX()
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' })
}

/**
 * Parsea Excel/CSV de extracto: detecta la fila de encabezado, mapea columnas
 * por heurística (sobreescribible) y normaliza fecha/monto/signo.
 */
export async function parseBankFile(
  file: File,
  overrideMapping?: Partial<BankColumnMapping>,
): Promise<ParsedBankFile> {
  const matrix = await readMatrix(file)
  const warnings: string[] = []
  if (matrix.length === 0) {
    return { rows: [], headers: [], mapping: emptyMapping(), warnings: ['El archivo está vacío.'] }
  }

  // La fila de encabezado es la de mayor puntaje de keywords (entre las
  // primeras 25 filas, por si el banco antepone un preámbulo).
  let headerIdx = 0
  let best = -1
  for (let i = 0; i < Math.min(matrix.length, 25); i++) {
    const sc = headerScore(matrix[i])
    if (sc > best) {
      best = sc
      headerIdx = i
    }
  }
  if (best <= 0) warnings.push('No se reconocieron columnas por su nombre — revisa el mapeo.')

  const headers = matrix[headerIdx].map((c) => String(c ?? '').trim())
  const mapping: BankColumnMapping = { ...detectMapping(headers), ...overrideMapping }

  if (!mapping.date) warnings.push('No se encontró columna de fecha.')
  if (!mapping.amount && !(mapping.debit || mapping.credit)) {
    warnings.push('No se encontró columna de monto (ni débito/crédito).')
  }

  const colIdx = (h: string | null): number => (h ? headers.indexOf(h) : -1)
  const di = colIdx(mapping.date)
  const ci = colIdx(mapping.description)
  const ri = colIdx(mapping.reference)
  const ai = colIdx(mapping.amount)
  const dbi = colIdx(mapping.debit)
  const cri = colIdx(mapping.credit)
  const bi = colIdx(mapping.balance)

  const rows: ParsedBankRow[] = []
  let skipped = 0
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const cells = matrix[r]
    if (!cells || cells.every((c) => String(c ?? '').trim() === '')) continue

    const dateISO = di >= 0 ? parseDateFlexible(cells[di]) : ''
    if (!dateISO) {
      skipped++
      continue
    }

    let amount = NaN
    if (ai >= 0) {
      amount = parseAmountCO(cells[ai])
    } else {
      const debit = dbi >= 0 ? parseAmountCO(cells[dbi]) : NaN
      const credit = cri >= 0 ? parseAmountCO(cells[cri]) : NaN
      const d = Number.isNaN(debit) ? 0 : Math.abs(debit)
      const c = Number.isNaN(credit) ? 0 : Math.abs(credit)
      if (d === 0 && c === 0) {
        skipped++
        continue
      }
      amount = c - d
    }
    if (Number.isNaN(amount) || amount === 0) {
      skipped++
      continue
    }

    const raw: Record<string, string> = {}
    headers.forEach((h, idx) => {
      if (h) raw[h] = String(cells[idx] ?? '').trim()
    })

    rows.push({
      date: dateISO,
      description: ci >= 0 ? String(cells[ci] ?? '').trim() : '',
      reference: ri >= 0 ? String(cells[ri] ?? '').trim() || undefined : undefined,
      amount,
      direction: amount >= 0 ? 'in' : 'out',
      balance: bi >= 0 ? (Number.isNaN(parseAmountCO(cells[bi])) ? undefined : parseAmountCO(cells[bi])) : undefined,
      raw,
    })
  }

  if (skipped > 0) warnings.push(`${skipped} filas omitidas (sin fecha o monto válido).`)
  if (rows.length === 0) warnings.push('No se extrajo ningún movimiento.')

  return { rows, headers, mapping, warnings }
}

function emptyMapping(): BankColumnMapping {
  return { date: null, description: null, reference: null, amount: null, debit: null, credit: null, balance: null }
}

// ── Mapeo persistido por company ────────────────────────────────────

export async function getSavedMapping(companyId: string): Promise<Partial<BankColumnMapping> | null> {
  if (!companyId) return null
  const ref = doc(db, 'companies', companyId, SETTINGS, SETTINGS_BANK_IMPORT)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return (snap.data().mapping ?? null) as Partial<BankColumnMapping> | null
}

export async function saveMapping(
  companyId: string,
  mapping: BankColumnMapping,
  bank: string,
): Promise<void> {
  if (!companyId) return
  const ref = doc(db, 'companies', companyId, SETTINGS, SETTINGS_BANK_IMPORT)
  await setDoc(ref, { mapping, bank, updatedAt: Timestamp.now() }, { merge: true })
}

// ── Import idempotente ──────────────────────────────────────────────

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

/**
 * statementId determinístico: dos importes del mismo archivo/banco/periodo/
 * conteo producen el mismo id ⇒ reimportar reemplaza, no duplica.
 */
export function computeStatementId(
  bank: string,
  fileName: string,
  periodStart: string,
  periodEnd: string,
  rowCount: number,
): string {
  return `${slug(bank) || 'banco'}_${slug(fileName)}_${periodStart}_${periodEnd}_${rowCount}`
}

export interface ImportBankParams {
  bank: string
  fileName: string
  rows: ParsedBankRow[]
}

export interface ImportBankResult {
  statementId: string
  imported: number
  periodStart: string
  periodEnd: string
  /** Otros statements de la misma cuenta cuyo periodo se solapa. */
  overlapping: { id: string; fileName: string; periodStart: string; periodEnd: string }[]
}

function invalidateBank(companyId: string): void {
  queryClient.invalidateQueries({ queryKey: ['firestore', companyId, BANK_MOVEMENTS] })
  queryClient.invalidateQueries({ queryKey: ['firestore', companyId, BANK_STATEMENTS] })
  queryClient.invalidateQueries({ queryKey: ['bank-movements', companyId] })
  queryClient.invalidateQueries({ queryKey: ['bank-statements', companyId] })
}

export async function importBankStatement(
  companyId: string,
  params: ImportBankParams,
): Promise<ImportBankResult> {
  if (!companyId) throw new Error('No hay empresa activa seleccionada.')
  const { bank, fileName, rows } = params
  if (rows.length === 0) throw new Error('No hay movimientos para importar.')

  const dates = rows.map((r) => r.date).filter(Boolean).sort()
  const periodStart = dates[0]
  const periodEnd = dates[dates.length - 1]
  const statementId = computeStatementId(bank, fileName, periodStart, periodEnd, rows.length)

  // Idempotencia: borrar movimientos previos de este statement antes de
  // reescribir (si el archivo cambió pero el id coincide, no quedan stale).
  const movRef = companyCollection(companyId, BANK_MOVEMENTS)
  const prev = await getDocs(query(movRef, where('statementId', '==', statementId)))
  if (!prev.empty) {
    for (let i = 0; i < prev.docs.length; i += BATCH_LIMIT) {
      const b = writeBatch(db)
      prev.docs.slice(i, i + BATCH_LIMIT).forEach((d) => b.delete(d.ref))
      await b.commit()
    }
  }

  // Escritura batched (≤450 por commit, patrón transaction-sync.ts).
  const now = Timestamp.now()
  for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
    const b = writeBatch(db)
    rows.slice(i, i + BATCH_LIMIT).forEach((row, j) => {
      const idx = i + j
      const movId = `${statementId}_${String(idx).padStart(4, '0')}`
      const movement: Omit<BankMovement, 'id'> = {
        date: Timestamp.fromDate(new Date(`${row.date}T12:00:00`)),
        description: row.description,
        ...(row.reference ? { reference: row.reference } : {}),
        amount: Math.round(row.amount * 100) / 100,
        direction: row.direction,
        ...(row.balance !== undefined ? { balance: row.balance } : {}),
        rawRow: row.raw,
        statementId,
        bank,
        reconcileStatus: 'pending',
        createdAt: now,
        updatedAt: now,
      }
      b.set(doc(movRef, movId), movement)
    })
    await b.commit()
  }

  const stmt: Omit<BankStatement, 'id'> = {
    fileName,
    bank,
    periodStart: Timestamp.fromDate(new Date(`${periodStart}T12:00:00`)),
    periodEnd: Timestamp.fromDate(new Date(`${periodEnd}T12:00:00`)),
    rowCount: rows.length,
    status: 'imported',
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(doc(companyCollection(companyId, BANK_STATEMENTS), statementId), stmt)

  // Aviso de solape de periodo con otros extractos ya importados.
  const all = await getDocs(companyCollection(companyId, BANK_STATEMENTS))
  const overlapping = all.docs
    .filter((d) => d.id !== statementId)
    .map((d) => ({ id: d.id, ...(d.data() as Omit<BankStatement, 'id'>) }))
    .filter((s) => {
      const sStart = s.periodStart.toDate().toISOString().slice(0, 10)
      const sEnd = s.periodEnd.toDate().toISOString().slice(0, 10)
      return sStart <= periodEnd && periodStart <= sEnd
    })
    .map((s) => ({
      id: s.id,
      fileName: s.fileName,
      periodStart: s.periodStart.toDate().toISOString().slice(0, 10),
      periodEnd: s.periodEnd.toDate().toISOString().slice(0, 10),
    }))

  invalidateBank(companyId)
  return { statementId, imported: rows.length, periodStart, periodEnd, overlapping }
}

// ── Lecturas ────────────────────────────────────────────────────────

export async function listStatements(companyId: string): Promise<BankStatement[]> {
  if (!companyId) return []
  const snap = await getDocs(
    query(companyCollection(companyId, BANK_STATEMENTS), orderBy('periodEnd', 'desc')),
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BankStatement, 'id'>) }))
}

export async function getBankMovements(
  companyId: string,
  statementId?: string,
): Promise<BankMovement[]> {
  if (!companyId) return []
  const ref = companyCollection(companyId, BANK_MOVEMENTS)
  const q = statementId
    ? query(ref, where('statementId', '==', statementId), orderBy('date', 'asc'))
    : query(ref, orderBy('date', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BankMovement, 'id'>) }))
}

// ── Conciliación (Fase 3): dispara la callable nueva ────────────────

export interface ReconcileResult {
  statementId: string
  periodStart: string
  periodEnd: string
  movements: number
  inflows: number
  closingsCount: number
  posRappiGross: number
  posVentasSeen: number
  bankRappiNet: number
  bankTcNet: number
  sumDatafonoClosings: number
  rappiCommission: number
  rappiStatus: 'derived' | 'partial' | 'skipped'
  tcRetencion: number
  tcStatus: 'derived' | 'partial' | 'skipped'
  derivedTransactions: { type: string; amount: number; transactionId: string }[]
  partialCount: number
}

export async function runBankReconcile(
  companyId: string,
  statementId?: string,
): Promise<ReconcileResult> {
  if (!companyId) throw new Error('No hay empresa activa seleccionada.')
  const fns = await getAppFunctions()
  const fn = httpsCallable<{ companyId: string; statementId?: string }, ReconcileResult>(
    fns,
    'reconcileBankStatement',
  )
  const res = await fn({ companyId, statementId })
  // La conciliación creó transactions derivadas → refrescar Facturación/P&L.
  invalidateBank(companyId)
  queryClient.invalidateQueries({ queryKey: ['firestore', companyId, TRANSACTIONS] })
  queryClient.invalidateQueries({ queryKey: ['firestore-paginated', companyId, TRANSACTIONS] })
  return res.data
}
