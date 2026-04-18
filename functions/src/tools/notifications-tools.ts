import { tool } from 'ai'
import { z } from 'zod'
import { fetchCollection } from '../firestore.js'

function tsToIso(val: unknown): string | null {
  if (val && typeof val === 'object' && '_seconds' in val) {
    return new Date((val as { _seconds: number })._seconds * 1000).toISOString()
  }
  return null
}

export function createNotificationsTools(companyId: string) {
  return {
    getNotifications: tool({
      description:
        'Obtiene las notificaciones internas del sistema (reportes semanales, alertas de mora, recordatorios de cierre, aumentos de precio). Puede filtrar por tipo o por no leídas.',
      parameters: z.object({
        onlyUnread: z.boolean().optional().default(false).describe('Si es true, solo retorna no leídas'),
        type: z
          .enum(['weekly-report', 'overdue-alert', 'closing-reminder', 'price-increase'])
          .optional()
          .describe('Filtrar por tipo de notificación'),
        limit: z.number().optional().default(20).describe('Máximo de resultados (default: 20)'),
      }),
      execute: async ({ onlyUnread, type, limit }) => {
        const all = await fetchCollection(companyId, 'notifications')
        let filtered = all
        if (onlyUnread) filtered = filtered.filter((n) => !n.read)
        if (type) filtered = filtered.filter((n) => n.type === type)
        filtered.sort((a, b) => {
          const aTs = (a.createdAt as { _seconds?: number })?._seconds ?? 0
          const bTs = (b.createdAt as { _seconds?: number })?._seconds ?? 0
          return bTs - aTs
        })
        const limited = filtered.slice(0, limit)
        return {
          totalCount: all.length,
          unreadCount: all.filter((n) => !n.read).length,
          returnedCount: limited.length,
          notifications: limited.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            summary: n.summary,
            read: n.read,
            createdAt: tsToIso(n.createdAt),
          })),
        }
      },
    }),

    markNotificationsRead: tool({
      description: 'Marca notificaciones como leídas. Requiere confirmación del usuario.',
      parameters: z.object({
        ids: z.array(z.string()).describe('IDs de las notificaciones a marcar como leídas'),
      }),
    }),

    createNotification: tool({
      description:
        'Crea una nueva notificación interna (útil para dejar recordatorios al usuario). Requiere confirmación del usuario.',
      parameters: z.object({
        type: z
          .enum(['weekly-report', 'overdue-alert', 'closing-reminder', 'price-increase'])
          .describe('Tipo de notificación'),
        title: z.string().describe('Título corto'),
        summary: z.string().describe('Resumen o mensaje de la notificación'),
      }),
    }),
  }
}
