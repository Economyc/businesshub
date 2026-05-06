// Wave 5.2 — Tools del agente para reportes programados.
//
// - listScheduledReports: con execute (lectura segura).
// - createScheduledReport / toggleScheduledReport / deleteScheduledReport:
//   sin execute, son client-rendered (requieren confirmación humana). El
//   cliente las ejecuta vía executeMutation reusando el servicio
//   scheduledReportService.

import { tool } from 'ai'
import { z } from 'zod'
import { fetchCollection } from '../firestore.js'

function tsToIso(val: unknown): string | null {
  if (val && typeof val === 'object' && '_seconds' in val) {
    return new Date((val as { _seconds: number })._seconds * 1000).toISOString()
  }
  return null
}

const reportTypeEnum = z.enum(['pnl', 'cashflow', 'sales', 'expenses', 'executive'])
const periodEnum = z.enum(['daily', 'weekly', 'monthly'])
const channelEnum = z.enum(['email', 'whatsapp', 'firestore'])

export function createScheduledReportsTools(companyId: string) {
  return {
    listScheduledReports: tool({
      description:
        'Lista los reportes programados (P&L, ventas, gastos, ejecutivo) de la compañía activa. Útil cuando el usuario pregunta "qué reportes recibo automáticamente".',
      parameters: z.object({
        enabledOnly: z
          .boolean()
          .optional()
          .default(false)
          .describe('Si es true, sólo devuelve reportes con enabled=true.'),
      }),
      execute: async ({ enabledOnly }) => {
        const all = await fetchCollection(companyId, 'scheduledReports')
        const filtered = enabledOnly ? all.filter((r) => r.enabled) : all
        return {
          totalCount: all.length,
          enabledCount: all.filter((r) => r.enabled).length,
          returnedCount: filtered.length,
          reports: filtered.map((r) => ({
            id: r.id,
            name: r.name,
            reportType: r.reportType,
            period: r.period,
            dayOfWeek: r.dayOfWeek ?? null,
            dayOfMonth: r.dayOfMonth ?? null,
            hour: r.hour,
            channel: r.channel,
            recipient: r.recipient,
            enabled: Boolean(r.enabled),
            lastSentAt: tsToIso(r.lastSentAt),
          })),
        }
      },
    }),

    createScheduledReport: tool({
      description:
        'Crea un nuevo reporte programado (P&L semanal, resumen diario, etc.). NO ejecuta — el cliente pide confirmación al usuario antes de guardar.',
      parameters: z.object({
        name: z.string().describe('Nombre humano del reporte (ej: "P&L semanal").'),
        reportType: reportTypeEnum.describe('Tipo de reporte a generar.'),
        period: periodEnum.describe('Frecuencia: diario, semanal o mensual.'),
        dayOfWeek: z
          .number()
          .int()
          .min(0)
          .max(6)
          .optional()
          .describe('Sólo para period=weekly. 0=domingo, 6=sábado.'),
        dayOfMonth: z
          .number()
          .int()
          .min(1)
          .max(31)
          .optional()
          .describe('Sólo para period=monthly. Día del mes (1–31).'),
        hour: z.number().int().min(0).max(23).describe('Hora local Bogotá (0–23) en que se envía.'),
        channel: channelEnum.describe('Canal de entrega.'),
        recipient: z
          .string()
          .describe('Destinatario: email, número de WhatsApp con prefijo, o cualquier id.'),
      }),
      // Sin execute: client-rendered con confirmación.
    }),

    toggleScheduledReport: tool({
      description:
        'Activa o desactiva un reporte programado existente. NO ejecuta — el cliente pide confirmación.',
      parameters: z.object({
        id: z.string().describe('ID del reporte programado.'),
        enabled: z.boolean().describe('true para activar, false para pausar.'),
      }),
    }),

    deleteScheduledReport: tool({
      description:
        'Elimina un reporte programado. NO ejecuta — el cliente pide confirmación al usuario.',
      parameters: z.object({
        id: z.string().describe('ID del reporte programado a eliminar.'),
      }),
    }),
  }
}
