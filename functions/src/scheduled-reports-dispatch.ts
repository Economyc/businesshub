// Wave 5.2 — Reportes programados (dispatcher).
//
// Cron `0 * * * *` (cada hora en punto, hora Bogotá). Recorre todas las
// companies, lee `companies/{cid}/scheduledReports` con enabled=true, y para
// cada uno decide si toca enviarlo según period/dayOfWeek/dayOfMonth/hour vs
// la hora actual local Bogotá.
//
// Si toca: genera el reporte (helper por reportType), lo entrega por el canal
// configurado (con fallback a firestore si no hay credenciales) y actualiza
// `lastSentAt`. Idempotencia: si `lastSentAt` ocurrió hace <1h se salta.

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { db, fetchCollection, fetchSettingsDoc } from './firestore.js'
import { deliverReport, type DeliveryChannel } from './report-delivery.js'

// ─── Tipos locales ───

type ReportType = 'pnl' | 'cashflow' | 'sales' | 'expenses' | 'executive'
type Period = 'daily' | 'weekly' | 'monthly'

interface ScheduledReportDoc {
  id: string
  name: string
  reportType: ReportType
  period: Period
  dayOfWeek?: number
  dayOfMonth?: number
  hour: number
  channel: DeliveryChannel
  recipient: string
  enabled: boolean
  lastSentAt?: { _seconds?: number; toMillis?: () => number } | null
}

interface BogotaParts {
  year: number
  month: number // 1–12
  day: number // 1–31
  dayOfWeek: number // 0=Sun..6=Sat
  hour: number // 0–23
}

// ─── Helpers de tiempo ───

const TIMEZONE = 'America/Bogota'

function toBogotaParts(date: Date): BogotaParts {
  // Intl da partes locales sin librerías externas. weekday 'short' devuelve
  // Sun, Mon, etc.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    dtf.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    dayOfWeek: weekdayMap[parts.weekday] ?? 0,
    hour: Number(parts.hour),
  }
}

function lastDayOfMonth(year: number, month: number): number {
  // month 1..12, Date(year, month, 0) da el último día del mes anterior.
  return new Date(year, month, 0).getDate()
}

function isoDateAddDays(dateIso: string, deltaDays: number): string {
  const d = new Date(dateIso)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().split('T')[0]
}

function tsToMillis(val: ScheduledReportDoc['lastSentAt']): number {
  if (!val) return 0
  if (typeof val === 'object' && '_seconds' in val && typeof val._seconds === 'number') {
    return val._seconds * 1000
  }
  if (typeof val === 'object' && typeof val.toMillis === 'function') {
    return val.toMillis()
  }
  return 0
}

function shouldRunNow(report: ScheduledReportDoc, nowParts: BogotaParts): boolean {
  if (report.hour !== nowParts.hour) return false
  if (report.period === 'daily') return true
  if (report.period === 'weekly') {
    return report.dayOfWeek === nowParts.dayOfWeek
  }
  if (report.period === 'monthly') {
    const targetDay = report.dayOfMonth ?? 1
    const last = lastDayOfMonth(nowParts.year, nowParts.month)
    // Si el mes no tiene ese día, usar el último día del mes (28/31, etc.).
    const effective = Math.min(targetDay, last)
    return effective === nowParts.day
  }
  return false
}

// ─── Helpers de cálculo ───

function tsToDate(val: unknown): Date | null {
  if (!val) return null
  if (typeof val === 'object' && val !== null && '_seconds' in val) {
    return new Date((val as { _seconds: number })._seconds * 1000)
  }
  return null
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

function fmtCop(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-CO')}`
}

function filterByPeriod(
  txs: Record<string, unknown>[],
  startIso: string,
  endIso: string,
): Record<string, unknown>[] {
  const start = new Date(startIso)
  const end = new Date(endIso)
  end.setHours(23, 59, 59, 999)
  return txs.filter((t) => {
    const d = tsToDate(t.date)
    return d && d >= start && d <= end
  })
}

function periodWindow(period: Period, nowParts: BogotaParts): { startIso: string; endIso: string } {
  // endIso = ayer (no incluye el día de envío en curso, que típicamente recién
  // empezó). startIso depende del period.
  const todayIso = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}-${String(nowParts.day).padStart(2, '0')}`
  const endIso = isoDateAddDays(todayIso, -1)
  let startIso: string
  if (period === 'daily') {
    startIso = endIso
  } else if (period === 'weekly') {
    startIso = isoDateAddDays(endIso, -6)
  } else {
    startIso = isoDateAddDays(endIso, -29)
  }
  return { startIso, endIso }
}

// ─── Generadores de reporte ───
//
// Cada generador devuelve { subject, html, text }. Los datos vienen de
// `companies/{cid}/transactions` (mismo backend que usa generateExecutiveReport).

interface ReportContent {
  subject: string
  htmlBody: string
  textBody: string
}

async function buildReport(
  companyId: string,
  reportType: ReportType,
  period: Period,
  nowParts: BogotaParts,
  reportName: string,
): Promise<ReportContent> {
  const { startIso, endIso } = periodWindow(period, nowParts)

  if (reportType === 'pnl' || reportType === 'executive') {
    const [txs, budget] = await Promise.all([
      fetchCollection(companyId, 'transactions'),
      fetchSettingsDoc(companyId, 'budget'),
    ])
    const periodTxs = filterByPeriod(txs, startIso, endIso)
    const income = periodTxs.filter((t) => t.type === 'income').reduce((s, t) => s + num(t.amount), 0)
    const expenses = periodTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + num(t.amount), 0)
    const net = income - expenses
    const margin = income > 0 ? (net / income) * 100 : 0
    const budgetItems = (budget?.items as Array<{ type: string; amount: number }> | undefined) ?? []
    const budgetExpenses = budgetItems.filter((i) => i.type === 'expense').reduce((s, i) => s + i.amount, 0)
    const subject = `${reportName} — ${startIso} a ${endIso}`
    const lines = [
      `Periodo: ${startIso} a ${endIso}`,
      `Ingresos: ${fmtCop(income)}`,
      `Gastos: ${fmtCop(expenses)}`,
      `Utilidad neta: ${fmtCop(net)}`,
      `Margen: ${margin.toFixed(1)}%`,
      budgetExpenses > 0
        ? `Ejecución vs presupuesto de gastos: ${((expenses / budgetExpenses) * 100).toFixed(1)}%`
        : 'Sin presupuesto configurado',
      `Transacciones: ${periodTxs.length}`,
    ]
    return {
      subject,
      htmlBody: `<h2>${subject}</h2><ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>`,
      textBody: lines.join('\n'),
    }
  }

  if (reportType === 'cashflow') {
    const txs = await fetchCollection(companyId, 'transactions')
    const periodTxs = filterByPeriod(txs, startIso, endIso)
    const inflow = periodTxs.filter((t) => t.type === 'income' && t.status !== 'pending' && t.status !== 'overdue').reduce((s, t) => s + num(t.amount), 0)
    const outflow = periodTxs.filter((t) => t.type === 'expense' && t.status !== 'pending' && t.status !== 'overdue').reduce((s, t) => s + num(t.amount), 0)
    const pending = periodTxs.filter((t) => t.status === 'pending' || t.status === 'overdue').reduce((s, t) => s + num(t.amount), 0)
    const subject = `${reportName} — flujo de caja ${startIso} a ${endIso}`
    const lines = [
      `Periodo: ${startIso} a ${endIso}`,
      `Entradas confirmadas: ${fmtCop(inflow)}`,
      `Salidas confirmadas: ${fmtCop(outflow)}`,
      `Caja neta: ${fmtCop(inflow - outflow)}`,
      `Pendiente / vencido: ${fmtCop(pending)}`,
    ]
    return {
      subject,
      htmlBody: `<h2>${subject}</h2><ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>`,
      textBody: lines.join('\n'),
    }
  }

  if (reportType === 'sales') {
    const txs = await fetchCollection(companyId, 'transactions')
    const periodTxs = filterByPeriod(txs, startIso, endIso).filter((t) => t.type === 'income')
    const total = periodTxs.reduce((s, t) => s + num(t.amount), 0)
    const byCategory = new Map<string, number>()
    for (const t of periodTxs) {
      const cat = String(t.category || 'Sin categoría')
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + num(t.amount))
    }
    const top = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const subject = `${reportName} — ventas ${startIso} a ${endIso}`
    const lines = [
      `Periodo: ${startIso} a ${endIso}`,
      `Total ingresos: ${fmtCop(total)}`,
      `Transacciones: ${periodTxs.length}`,
      'Top categorías:',
      ...top.map(([c, v]) => `  - ${c}: ${fmtCop(v)}`),
    ]
    return {
      subject,
      htmlBody: `<h2>${subject}</h2><ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>`,
      textBody: lines.join('\n'),
    }
  }

  // expenses
  const txs = await fetchCollection(companyId, 'transactions')
  const periodTxs = filterByPeriod(txs, startIso, endIso).filter((t) => t.type === 'expense')
  const total = periodTxs.reduce((s, t) => s + num(t.amount), 0)
  const byCategory = new Map<string, number>()
  for (const t of periodTxs) {
    const cat = String(t.category || 'Sin categoría')
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + num(t.amount))
  }
  const top = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const subject = `${reportName} — gastos ${startIso} a ${endIso}`
  const lines = [
    `Periodo: ${startIso} a ${endIso}`,
    `Total gastos: ${fmtCop(total)}`,
    `Transacciones: ${periodTxs.length}`,
    'Top categorías:',
    ...top.map(([c, v]) => `  - ${c}: ${fmtCop(v)}`),
  ]
  return {
    subject,
    htmlBody: `<h2>${subject}</h2><ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>`,
    textBody: lines.join('\n'),
  }
}

// ─── Cron principal ───

async function getAllCompanyIds(): Promise<string[]> {
  const snapshot = await db.collection('companies').get()
  return snapshot.docs.map((d) => d.id)
}

export const dispatchScheduledReports = onSchedule(
  {
    schedule: '0 * * * *',
    timeZone: TIMEZONE,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const now = new Date()
    const nowParts = toBogotaParts(now)
    const companyIds = await getAllCompanyIds()

    const summary = {
      companies: companyIds.length,
      considered: 0,
      sent: 0,
      skippedRecent: 0,
      errors: 0,
    }

    for (const companyId of companyIds) {
      try {
        const reports = (await fetchCollection(companyId, 'scheduledReports')) as unknown as ScheduledReportDoc[]
        for (const report of reports) {
          if (!report.enabled) continue
          if (!shouldRunNow(report, nowParts)) continue
          summary.considered++

          // Idempotencia: si lastSentAt fue hace <1h, saltar.
          const lastMs = tsToMillis(report.lastSentAt)
          if (lastMs > 0 && now.getTime() - lastMs < 60 * 60 * 1000) {
            summary.skippedRecent++
            continue
          }

          try {
            const content = await buildReport(
              companyId,
              report.reportType,
              report.period,
              nowParts,
              report.name,
            )
            const result = await deliverReport({
              companyId,
              scheduledReportId: report.id,
              reportType: report.reportType,
              channel: report.channel,
              recipient: report.recipient,
              subject: content.subject,
              htmlBody: content.htmlBody,
              textBody: content.textBody,
            })
            // Marcar lastSentAt aunque haya caído en fallback (el reporte sí
            // se entregó al menos a firestore).
            await db
              .collection('companies')
              .doc(companyId)
              .collection('scheduledReports')
              .doc(report.id)
              .update({
                lastSentAt: Timestamp.now(),
                updatedAt: FieldValue.serverTimestamp(),
              })
            summary.sent++
            console.log(
              `[ScheduledReports] enviado company=${companyId} id=${report.id} channel=${result.channelUsed} fellBack=${result.fellBack}`,
            )
          } catch (err) {
            summary.errors++
            console.error(
              `[ScheduledReports] error generando/enviando company=${companyId} id=${report.id}`,
              err,
            )
          }
        }
      } catch (err) {
        summary.errors++
        console.error(`[ScheduledReports] error leyendo company=${companyId}`, err)
      }
    }

    console.log('[ScheduledReports] run summary', summary)
  },
)
