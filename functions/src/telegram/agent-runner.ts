// Loop LLM del bot de Telegram. Clon de agent-chat.ts pero con generateText
// (sin streaming): Telegram no renderiza chunks, así que esperamos el turno
// completo y mandamos el texto. Mismo LLMRouter, mismo system prompt, mismo
// retry con fallback entre proveedores.

import { generateText, type CoreMessage, type ToolSet } from 'ai'
import {
  LLMRouter,
  isRateLimitError,
  parseRetryAfter,
  messagesContainImages,
} from '../llm-router.js'
import {
  getAgentSystemPrompt,
  type CompanyContext,
  type UserAgentMemory,
} from '../system-prompt.js'
import { getLangfuseClient, flushLangfuse } from '../observability/langfuse.js'

const MAX_RETRIES = 2

// El addendum adapta el agente al canal: formato y protocolo de confirmación.
const TELEGRAM_PROMPT_ADDENDUM = `

## Canal: Telegram
Estás respondiendo por Telegram (chat móvil), no en la web. Reglas del canal:
- Respuestas CORTAS y directas. Nada de tablas markdown ni headers — usa listas con guiones.
- Montos en formato colombiano: $1.250.000.
- Las herramientas de ESCRITURA (createTransaction, createPayableDocument, quickMarkInvoiceAsPaid, markInvoiceAsPaid) requieren que el usuario confirme con un botón. Cuando invoques una, NO digas que ya quedó hecho — el sistema muestra el resumen con botones de confirmación.
- Invoca UNA SOLA herramienta de escritura por mensaje del usuario. Si pide varias cosas, hazlas de a una.
- Las herramientas de lectura aceptan un parámetro companyName opcional para consultar otro local sin cambiar el activo.
- Si el usuario manda una foto de factura, extrae los campos (proveedor, número, fecha, monto, categoría) y llama createPayableDocument.
- En fotos de facturas/recibos: busca el número del documento con cuidado — aparece como "Factura", "No.", "NRO", "TRX" o el consecutivo del ticket. Solo si de verdad no es legible, usa la fecha compacta como número (ej. "20260610") y acláralo en tu respuesta para que el usuario lo corrija si quiere.
- CORRECCIONES: si el usuario responde a una operación propuesta corrigiendo datos (monto, categoría, número, fecha, proveedor) en vez de confirmarla, vuelve a invocar la MISMA herramienta con todos los campos, aplicando solo las correcciones. El archivo adjunto sigue disponible — NO le pidas reenviarlo.`

let router: LLMRouter | null = null

function getRouter(geminiKey: string, groqKey: string, cerebrasKey: string): LLMRouter {
  if (!router) {
    router = new LLMRouter().addGemini(geminiKey).addGroq(groqKey).addCerebras(cerebrasKey)
  }
  return router
}

export interface PendingToolCall {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

export interface AgentTurnResult {
  text: string
  /** Mensajes assistant/tool generados por el SDK durante el turno. */
  responseMessages: CoreMessage[]
  /** Tool-calls de escritura (tools sin execute) que esperan confirmación. */
  pendingToolCalls: PendingToolCall[]
}

export class AllProvidersBusyError extends Error {
  constructor() {
    super('Todos los proveedores de AI están temporalmente limitados. Intenta en un minuto.')
  }
}

export async function runAgentTurn(opts: {
  messages: CoreMessage[]
  companies: CompanyContext[]
  activeCompanyId: string
  userMemory: UserAgentMemory | null
  tools: ToolSet
  geminiKey: string
  groqKey: string
  cerebrasKey: string
  userId: string
  chatId: number
  needsPdfNative?: boolean
  /** Contexto adicional para el system prompt (ej. catálogo de categorías). */
  extraSystemContext?: string
}): Promise<AgentTurnResult> {
  const needsVision = messagesContainImages(opts.messages as unknown[])
  const system =
    getAgentSystemPrompt({
      companies: opts.companies,
      activeCompanyId: opts.activeCompanyId,
      userMemory: opts.userMemory,
    }) +
    TELEGRAM_PROMPT_ADDENDUM +
    (opts.extraSystemContext ? `\n\n${opts.extraSystemContext}` : '')

  const lf = getLangfuseClient()
  const trace = lf?.trace({
    name: 'telegram-agent',
    userId: opts.userId,
    sessionId: `tg-${opts.chatId}`,
    metadata: { companyId: opts.activeCompanyId, needsVision },
    input: opts.messages,
    tags: ['agent', 'telegram', `company:${opts.activeCompanyId}`],
  })

  let lastError: unknown = null
  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const llmRouter = getRouter(opts.geminiKey, opts.groqKey, opts.cerebrasKey)
      let providerName = 'unknown'
      try {
        const { model, provider } = await llmRouter.getModel({
          needsVision,
          needsPdfNative: opts.needsPdfNative,
        })
        providerName = provider
        console.log(`[TelegramAgent] Attempt ${attempt + 1} using ${provider}${needsVision ? ' (vision)' : ''}`)

        const generation = trace?.generation({
          name: 'generateText',
          model: provider,
          input: opts.messages,
          metadata: { attempt: attempt + 1, needsVision },
        })
        const startedAt = Date.now()

        const result = await generateText({
          model,
          system,
          messages: opts.messages,
          tools: opts.tools,
          maxSteps: 8,
        })

        // Con ToolSet genérico el SDK no infiere los tipos de tool-calls.
        const toolResults = result.toolResults as unknown as Array<{ toolCallId: string }>
        const toolCalls = result.toolCalls as unknown as Array<{
          toolCallId: string
          toolName: string
          args: Record<string, unknown>
        }>
        const resolvedIds = new Set(toolResults.map((r) => r.toolCallId))
        const pendingToolCalls: PendingToolCall[] = toolCalls
          .filter((tc) => !resolvedIds.has(tc.toolCallId))
          .map((tc) => ({
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args,
          }))

        generation?.end({
          output: { text: result.text, finishReason: result.finishReason },
          usage: result.usage as never,
          metadata: { latencyMs: Date.now() - startedAt },
        })
        trace?.update({
          output: { text: result.text, finishReason: result.finishReason },
          metadata: { provider, latencyMs: Date.now() - startedAt },
        })

        return {
          text: result.text,
          responseMessages: result.response.messages as CoreMessage[],
          pendingToolCalls,
        }
      } catch (error: unknown) {
        lastError = error
        if (isRateLimitError(error)) {
          const cooldown = parseRetryAfter(error)
          await getRouter(opts.geminiKey, opts.groqKey, opts.cerebrasKey).markRateLimited(providerName, cooldown)
          trace?.event({
            name: 'rate-limited',
            input: { provider: providerName, cooldownMs: cooldown },
            level: 'WARNING',
          })
          console.warn(`[TelegramAgent] ${providerName} rate limited, retrying with fallback...`)
          continue
        }
        trace?.update({
          output: { error: error instanceof Error ? error.message : String(error) },
          metadata: { provider: providerName },
        })
        throw error
      }
    }

    console.error('[TelegramAgent] All providers failed:', lastError)
    trace?.update({ output: { error: 'all_providers_rate_limited' } })
    throw new AllProvidersBusyError()
  } finally {
    await flushLangfuse(lf)
  }
}
