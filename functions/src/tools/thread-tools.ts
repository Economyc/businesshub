import { tool } from 'ai'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../firestore.js'

// Wave 4.2 — tool del agente para actualizar el estado persistente del
// thread activo. No requiere confirmación del usuario porque es metadata
// interna (contexto, próximas acciones, summary, status), no datos de
// negocio. Si el request no trae threadId, la tool es no-op para evitar
// confundir al modelo cuando se usa en conversación libre.
const ThreadStatusSchema = z.enum(['in_progress', 'done', 'blocked'])

export function createThreadTools(companyId: string, threadId: string | undefined) {
  return {
    updateThreadState: tool({
      description:
        'Actualiza el estado persistente del thread activo (tarea de larga duración). Usa esta tool cuando descubras un hecho relevante que vale la pena recordar entre sesiones (ej: "el mes a cerrar es abril 2026", "falta nómina"), cuando completes una próxima acción, o cuando agregues una nueva. NO requiere confirmación del usuario — es estado interno del thread. Si no hay thread activo, la llamada se ignora silenciosamente.',
      parameters: z.object({
        contextPatch: z
          .record(z.unknown())
          .optional()
          .describe(
            'Merge sobre el campo context del thread. Usa keys descriptivas (ej: { "mesEnCurso": "abril 2026", "pendientes": ["nomina","prestaciones"] }). No envíes el objeto completo, solo los cambios.',
          ),
        nextActionsAddOrRemove: z
          .object({
            add: z.array(z.string()).optional().describe('Acciones nuevas a agregar al checklist'),
            remove: z.array(z.string()).optional().describe('Acciones a quitar del checklist (deben coincidir literalmente con el texto guardado)'),
          })
          .optional()
          .describe('Modifica la lista de próximas acciones. Add y remove se aplican en ese orden.'),
        summary: z.string().optional().describe('Resumen ejecutivo del thread tras varios mensajes (opcional)'),
        status: ThreadStatusSchema.optional().describe('Cambia el estado del thread'),
      }),
      execute: async ({ contextPatch, nextActionsAddOrRemove, summary, status }) => {
        if (!threadId) {
          return { skipped: true, reason: 'no_active_thread' }
        }

        const ref = db
          .collection('companies')
          .doc(companyId)
          .collection('threads')
          .doc(threadId)

        // Para nextActions necesitamos read-modify-write porque queremos
        // dedupe en add y match exacto en remove. Firestore arrayUnion no
        // permite remover y arrayRemove no permite add atómico en la misma
        // operación de forma fiable con dedupe del lado del documento.
        const updates: Record<string, unknown> = {
          updatedAt: FieldValue.serverTimestamp(),
        }

        if (contextPatch && typeof contextPatch === 'object') {
          for (const [k, v] of Object.entries(contextPatch)) {
            updates[`context.${k}`] = v
          }
        }
        if (typeof summary === 'string') {
          updates.summary = summary
        }
        if (status) {
          updates.status = status
        }

        let nextActionsAfter: string[] | null = null
        if (nextActionsAddOrRemove && (nextActionsAddOrRemove.add || nextActionsAddOrRemove.remove)) {
          const snap = await ref.get()
          const current = (snap.exists && Array.isArray((snap.data() as { nextActions?: unknown }).nextActions)
            ? ((snap.data() as { nextActions: unknown[] }).nextActions as unknown[]).filter((a): a is string => typeof a === 'string')
            : [])
          const removeSet = new Set(nextActionsAddOrRemove.remove ?? [])
          const after = current.filter((a) => !removeSet.has(a))
          for (const a of nextActionsAddOrRemove.add ?? []) {
            if (!after.includes(a)) after.push(a)
          }
          updates.nextActions = after
          nextActionsAfter = after
        }

        await ref.update(updates)

        return {
          ok: true,
          threadId,
          appliedContextKeys: contextPatch ? Object.keys(contextPatch) : [],
          nextActions: nextActionsAfter,
          status: status ?? null,
          summary: summary ?? null,
        }
      },
    }),
  }
}
