import type { BankEntry } from '../types'

// papaparse (~80K) se carga dinamicamente solo al parsear un extracto.
const loadPapa = () => import('papaparse').then((m) => m.default)

export interface ColumnMapping {
  date: string
  description: string
  amount?: string
  debit?: string
  credit?: string
  reference?: string
  balance?: string
}

export interface CSVParseResult {
  entries: BankEntry[]
  periodStart: string
  periodEnd: string
  errors: { row: number; message: string }[]
}

const DATE_ALIASES = ['fecha', 'date', 'f. movimiento', 'f. valor', 'fecha movimiento', 'fecha valor']
const DESC_ALIASES = ['descripcion', 'concepto', 'description', 'detalle', 'movimiento', 'referencia']
const AMOUNT_ALIASES = ['monto', 'valor', 'amount', 'importe', 'total']
const DEBIT_ALIASES = ['debito', 'débito', 'debit', 'cargo', 'retiro', 'egreso']
const CREDIT_ALIASES = ['credito', 'crédito', 'credit', 'abono', 'deposito', 'ingreso']
const REF_ALIASES = ['referencia', 'ref', 'reference', 'numero', 'comprobante', 'document']
const BALANCE_ALIASES = ['saldo', 'balance']

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function findMatch(headers: string[], aliases: string[]): string | undefined {
  for (const h of headers) {
    const norm = normalize(h)
    if (aliases.some((a) => norm.includes(a))) return h
  }
  return undefined
}

export function guessColumnMapping(headers: string[]): Partial<ColumnMapping> {
  return {
    date: findMatch(headers, DATE_ALIASES),
    description: findMatch(headers, DESC_ALIASES),
    amount: findMatch(headers, AMOUNT_ALIASES),
    debit: findMatch(headers, DEBIT_ALIASES),
    credit: findMatch(headers, CREDIT_ALIASES),
    reference: findMatch(headers, REF_ALIASES),
    balance: findMatch(headers, BALANCE_ALIASES),
  }
}

function parseAmount(raw: string): number {
  if (!raw) return 0
  // Remove currency symbols, spaces, thousands separators
  const cleaned = raw.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function parseDate(raw: string): string | null {
  if (!raw) return null
  // Try ISO format first
  const iso = raw.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  // Try MM/DD/YYYY
  const mdy = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (mdy) {
    const year = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3]
    return `${year}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
  }
  return null
}

export async function parseBankCSV(file: File, mapping: ColumnMapping): Promise<CSVParseResult> {
  const Papa = await loadPapa()
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const entries: BankEntry[] = []
        const errors: { row: number; message: string }[] = []
        const rows = results.data as Record<string, string>[]

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const rowNum = i + 2 // 1-indexed + header

          const dateRaw = row[mapping.date] ?? ''
          const date = parseDate(dateRaw)
          if (!date) {
            errors.push({ row: rowNum, message: `Fecha invalida: "${dateRaw}"` })
            continue
          }

          const description = (row[mapping.description] ?? '').trim()
          if (!description) {
            errors.push({ row: rowNum, message: 'Descripcion vacia' })
            continue
          }

          let amount: number
          let type: 'credit' | 'debit'

          if (mapping.amount) {
            // Single amount column
            amount = parseAmount(row[mapping.amount] ?? '')
            if (amount === 0) {
              errors.push({ row: rowNum, message: 'Monto es 0 o invalido' })
              continue
            }
            type = amount > 0 ? 'credit' : 'debit'
            amount = Math.abs(amount)
          } else if (mapping.debit || mapping.credit) {
            // Dual columns
            const debitVal = mapping.debit ? parseAmount(row[mapping.debit] ?? '') : 0
            const creditVal = mapping.credit ? parseAmount(row[mapping.credit] ?? '') : 0
            if (debitVal === 0 && creditVal === 0) {
              errors.push({ row: rowNum, message: 'Debito y credito son 0' })
              continue
            }
            if (creditVal > 0) {
              amount = creditVal
              type = 'credit'
            } else {
              amount = debitVal
              type = 'debit'
            }
          } else {
            errors.push({ row: rowNum, message: 'No se encontro columna de monto' })
            continue
          }

          entries.push({
            id: crypto.randomUUID(),
            date,
            description,
            amount,
            type,
            reference: mapping.reference ? (row[mapping.reference] ?? '').trim() || undefined : undefined,
            balance: mapping.balance ? parseAmount(row[mapping.balance] ?? '') || undefined : undefined,
          })
        }

        entries.sort((a, b) => a.date.localeCompare(b.date))

        resolve({
          entries,
          periodStart: entries[0]?.date ?? '',
          periodEnd: entries[entries.length - 1]?.date ?? '',
          errors,
        })
      },
    })
  })
}
