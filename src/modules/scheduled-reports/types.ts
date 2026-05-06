// Wave 5.2 — Reportes programados.
//
// Tipos canónicos del módulo. El doc vive en
// `companies/{companyId}/scheduledReports/{id}` y lo lee tanto el cliente
// (CRUD desde UI / agente) como la Cloud Function `dispatchScheduledReports`
// que corre cada hora.

import type { Timestamp } from 'firebase/firestore'

export type ScheduledReportType =
  | 'pnl'
  | 'cashflow'
  | 'sales'
  | 'expenses'
  | 'executive'

export type ScheduledReportPeriod = 'daily' | 'weekly' | 'monthly'

export type ScheduledReportChannel = 'email' | 'whatsapp' | 'firestore'

export interface ScheduledReport {
  id: string
  name: string
  reportType: ScheduledReportType
  period: ScheduledReportPeriod
  // Sólo aplica si period = 'weekly'. 0 = domingo, 6 = sábado.
  dayOfWeek?: number
  // Sólo aplica si period = 'monthly'. 1–31; si el mes no tiene ese día se
  // dispara el último día del mes.
  dayOfMonth?: number
  // Hora local Bogotá (0–23) en la que se envía.
  hour: number
  channel: ScheduledReportChannel
  // Email destino, número de WhatsApp con prefijo, o cualquier id del canal.
  recipient: string
  enabled: boolean
  lastSentAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Form state para el dialog. createdAt/updatedAt los pone el helper de
// Firestore al guardar.
export type ScheduledReportFormData = Omit<
  ScheduledReport,
  'id' | 'createdAt' | 'updatedAt' | 'lastSentAt'
>

export const REPORT_TYPE_LABELS: Record<ScheduledReportType, string> = {
  pnl: 'P&L (Pérdidas y ganancias)',
  cashflow: 'Flujo de caja',
  sales: 'Resumen de ventas',
  expenses: 'Resumen de gastos',
  executive: 'Reporte ejecutivo',
}

export const PERIOD_LABELS: Record<ScheduledReportPeriod, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
}

export const CHANNEL_LABELS: Record<ScheduledReportChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  firestore: 'Sólo guardar en sistema',
}

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}
