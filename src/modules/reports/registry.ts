import {
  CalendarDays,
  CalendarRange,
  Clock,
  FileSpreadsheet,
  List,
  ListOrdered,
  Package,
  Table2,
  Tags,
  CalendarClock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  buildChannelByDay,
  buildChannelByWeek,
  buildChannelSummary,
  buildOrderDetail,
  buildOrdersByHour,
  buildOrdersByWeekday,
  buildProductsByCategory,
  buildProductsByChannel,
  type ReportContext,
  type ReportTableData,
} from './domain/builders'

export type ReportId = 'ventas-por-canal' | 'franja-horaria' | 'productos-por-canal' | 'detalle-pedidos'

export interface ReportSheet {
  id: string
  /** También es el nombre de la hoja del Excel (≤31 caracteres). */
  label: string
  icon: LucideIcon
  /** `detail`: una fila por pedido; tabla con encabezado fijo y tope de filas en pantalla. */
  kind: 'summary' | 'detail'
  build: (ctx: ReportContext) => ReportTableData
}

export interface ReportDefinition {
  id: ReportId
  category: 'domicilios'
  title: string
  icon: LucideIcon
  /** El resumen compara contra el periodo anterior. */
  comparesPrevious: boolean
  sheets: ReportSheet[]
  notes: string[]
}

const NOTE_NET_SALES = 'Venta neta del POS: no incluye propinas ni costo de envío. Los pedidos anulados no se cuentan.'
const NOTE_WEB =
  'Web incluye los pedidos de la web pagados en línea o contra entrega. El POS los registra como Delivery Telefónico; se reconocen por el pago en línea o por la dirección que envía la web.'

export const REPORT_CATEGORIES = [
  {
    id: 'domicilios' as const,
    title: 'Domicilios',
  },
]

export const REPORTS: ReportDefinition[] = [
  {
    id: 'ventas-por-canal',
    category: 'domicilios',
    title: 'Ventas por canal',
    icon: FileSpreadsheet,
    comparesPrevious: true,
    sheets: [
      { id: 'resumen', label: 'Resumen', icon: Table2, kind: 'summary', build: buildChannelSummary },
      { id: 'por-semana', label: 'Por semana', icon: CalendarRange, kind: 'summary', build: buildChannelByWeek },
      { id: 'por-dia', label: 'Por día', icon: CalendarDays, kind: 'summary', build: buildChannelByDay },
    ],
    notes: [
      NOTE_NET_SALES,
      NOTE_WEB,
      'La variación compara con el periodo anterior de igual duración (el mes anterior si el informe es de un mes completo). Si ese periodo no tuvo ventas en el canal, se marca como Nuevo.',
      'Por semana: bloques de 7 días desde el inicio del periodo; el último puede ser más corto.',
    ],
  },
  {
    id: 'franja-horaria',
    category: 'domicilios',
    title: 'Pedidos por franja horaria',
    icon: Clock,
    comparesPrevious: false,
    sheets: [
      { id: 'por-hora', label: 'Por hora', icon: Clock, kind: 'summary', build: buildOrdersByHour },
      { id: 'por-dia-semana', label: 'Por día de la semana', icon: CalendarClock, kind: 'summary', build: buildOrdersByWeekday },
    ],
    notes: [NOTE_NET_SALES, NOTE_WEB, 'La hora es la de emisión del comprobante en el POS, no la de entrega.'],
  },
  {
    id: 'productos-por-canal',
    category: 'domicilios',
    title: 'Productos por canal',
    icon: Package,
    comparesPrevious: false,
    sheets: [
      { id: 'por-producto', label: 'Por producto', icon: Package, kind: 'summary', build: buildProductsByChannel },
      { id: 'por-categoria', label: 'Por categoría', icon: Tags, kind: 'summary', build: buildProductsByCategory },
    ],
    notes: [
      'Unidades y venta según el detalle del comprobante. Las adiciones que el POS cobra dentro del precio del producto no aparecen como línea aparte.',
      'La suma de venta por producto sale del detalle y puede diferir de la venta neta: para el total de ventas usa el informe Ventas por canal.',
      NOTE_WEB,
    ],
  },
  {
    id: 'detalle-pedidos',
    category: 'domicilios',
    title: 'Detalle de pedidos',
    icon: List,
    comparesPrevious: false,
    sheets: [{ id: 'pedidos', label: 'Pedidos', icon: ListOrdered, kind: 'detail', build: buildOrderDetail }],
    notes: [
      NOTE_NET_SALES,
      NOTE_WEB,
      'Subtotal es el valor antes del impuesto al consumo; el envío se muestra aparte y no suma a la venta neta.',
      'El cliente es el registrado en el comprobante; puede venir vacío.',
    ],
  },
]

export function getReport(id: string | undefined): ReportDefinition | undefined {
  return REPORTS.find((r) => r.id === id)
}
