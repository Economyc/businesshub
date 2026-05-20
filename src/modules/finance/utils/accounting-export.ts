// Estructura de la hoja de seguimiento que pidió la contadora. Las columnas y
// su orden replican el archivo de ejemplo (facturas_pagadas_*.xlsx). Se usa
// tanto para la descarga local (.xlsx/.csv) como para el Google Sheet mensual
// que se sube a Drive.
import type { FieldDef } from '@/core/utils/data-transfer'
import { parseCategory } from '@/core/utils/categories'
import type { Transaction } from '../types'

// Fecha DD/MM/AAAA. Compartida con la tabla de facturación. Devuelve '—' cuando
// no hay fecha (data legacy) — en las filas exportadas la fecha siempre existe.
export function formatDate(ts: Transaction['date'] | undefined): string {
  const d = ts?.toDate?.()
  if (!d) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

// Fila plana lista para exportar. Se precomputa (en vez de usar field.format)
// porque Numeración necesita el índice y NIT necesita un lookup externo a
// proveedores — ninguno de los dos cabe en field.format(value).
export interface AccountingRow {
  // Index signature para encajar en SheetSpec.data (Record<string, unknown>).
  [key: string]: string | number
  numeracion: string
  fecha: string
  nit: string
  proveedor: string
  concepto: string
  categoria: string
  prioridad: string
  tipo: string
  numero: string
  valor: number
  estado: string
  metodoPago: string
  notas: string
}

export const ACCOUNTING_FIELDS: FieldDef[] = [
  { key: 'numeracion', header: 'Numeración', type: 'string' },
  { key: 'fecha', header: 'Fecha', type: 'string' },
  { key: 'nit', header: 'NIT', type: 'string' },
  { key: 'proveedor', header: 'Proveedor', type: 'string' },
  { key: 'concepto', header: 'Concepto', type: 'string' },
  { key: 'categoria', header: 'Categoría', type: 'string' },
  { key: 'prioridad', header: 'Prioridad', type: 'string' },
  { key: 'tipo', header: 'Tipo', type: 'string' },
  { key: 'numero', header: 'Número', type: 'string' },
  { key: 'valor', header: 'Valor', type: 'number' },
  { key: 'estado', header: 'Estado', type: 'string' },
  { key: 'metodoPago', header: 'Metodo Pago', type: 'string' },
  { key: 'notas', header: 'Notas', type: 'string' },
]

function tipoLabel(t: Transaction): string {
  return t.documentKind === 'invoice' ? 'Factura' : 'Compra'
}

function estadoLabel(status: Transaction['status']): string {
  if (status === 'paid') return 'Pagado'
  if (status === 'overdue') return 'Vencida'
  return 'Pendiente'
}

// Misma sanitización que el backend (doc-naming.sanitizeForFileName) para que
// la Numeración coincida con el nombre real del PDF aunque el proveedor o el
// número traigan caracteres especiales.
function sanitize(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').trim()
}

// La Numeración comparte el substring "{Proveedor} - {Tipo} {Número}" con el
// nombre del PDF en Drive (ver buildDocLocation en functions/utils/doc-naming),
// así la contadora filtra por proveedor o número y encuentra el documento.
function buildNumeracion(index: number, t: Transaction): string {
  const proveedor = sanitize(t.payeeRef?.name ?? 'Proveedor')
  const numero = sanitize(t.docNumber ?? '')
  return `${index}. ${proveedor} - ${tipoLabel(t)}${numero ? ` ${numero}` : ''}`
}

export function buildAccountingRows(
  txs: Transaction[],
  suppliersById: Map<string, string>,
  startIndex = 1,
): AccountingRow[] {
  return txs.map((t, i) => {
    const nit =
      t.payeeRef?.type === 'supplier' && t.payeeRef.id
        ? suppliersById.get(t.payeeRef.id) ?? ''
        : ''
    return {
      numeracion: buildNumeracion(startIndex + i, t),
      fecha: formatDate(t.date),
      nit,
      proveedor: t.payeeRef?.name ?? '',
      concepto: t.concept ?? '',
      categoria: parseCategory(t.category ?? '').category ?? '',
      prioridad: t.priority === 'immediate' ? 'Inmediato' : 'Espera',
      tipo: tipoLabel(t),
      numero: t.docNumber ?? '',
      valor: t.amount ?? 0,
      estado: estadoLabel(t.status),
      metodoPago: '',
      notas: t.notes ?? '',
    }
  })
}
