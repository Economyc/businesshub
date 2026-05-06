import { tool } from 'ai'
import { z } from 'zod'

// Wave 6.2 — Connector outbound a Obsidian.
//
// Cuando el usuario y el agente toman una decisión importante (cambio de
// proceso, ajuste de presupuesto, lección aprendida, hallazgo clave), el
// agente puede ofrecer guardarla en el vault de Obsidian del usuario. La
// integración real corre client-side: el cliente lee el endpoint local del
// plugin "Local REST API" desde localStorage y hace PUT a la nota.
//
// Esta tool NO tiene `execute()` — es client-rendered, igual que
// proposeMultiStepPlan. Sólo viajan los args (la nota propuesta) y el
// usuario aprueba en una card antes de que el cliente toque el endpoint.

export function createObsidianTools() {
  return {
    saveToObsidian: tool({
      description:
        'Propone guardar una nota (decisión, hallazgo, lección aprendida) en el vault de Obsidian del usuario vía el plugin Local REST API. NO ejecuta nada — el cliente renderiza una card con el preview y el usuario confirma. Úsala SOLO para conocimiento de valor (decisiones explícitas, root cause de bugs raros, políticas, descubrimientos). NO la uses para conversación trivial, datos transaccionales del negocio, ni respuestas que ya viven en Firestore.',
      parameters: z.object({
        title: z
          .string()
          .min(3)
          .describe(
            'Título descriptivo de la nota, sin extensión. Ejemplo: "Decisión: cambiar rate limit de 100 a 500".',
          ),
        content: z
          .string()
          .min(10)
          .describe(
            'Contenido de la nota en markdown. Estructura clara: contexto, decisión/hallazgo, justificación, próximos pasos. NO repitas el title aquí.',
          ),
        folder: z
          .string()
          .optional()
          .describe(
            'Carpeta destino dentro del vault. Default: "Inbox/auto". Usa rutas tipo "Proyectos/BusinessHub" o "Zettel" cuando aplique.',
          ),
        tags: z
          .array(z.string())
          .optional()
          .describe(
            'Tags de Obsidian sin el "#". Ejemplo: ["decisión", "BusinessHub", "rate-limit"].',
          ),
        frontmatter: z
          .record(z.unknown())
          .optional()
          .describe(
            'Frontmatter YAML adicional. Sugerencia: incluir "type" ("decisión" | "zettel" | "fuente" | "lección"), "date" (YYYY-MM-DD) y "source" si aplica.',
          ),
      }),
      // Sin execute(): client-rendered. El cliente hace fetch al endpoint
      // local del plugin Obsidian Local REST API tras la confirmación.
    }),
  }
}
