import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { streamText } from 'ai'
import { getAgentSystemPrompt } from './system-prompt.js'
import { createAgentTools } from './tools/index.js'
import { LLMRouter, isRateLimitError, parseRetryAfter, messagesContainImages } from './llm-router.js'
import { getLangfuseClient, flushLangfuse } from './observability/langfuse.js'

// Exportados para reuso por telegram/ (mismo agente, otro canal).
export const geminiApiKey = defineSecret('GEMINI_API_KEY')
export const groqApiKey = defineSecret('GROQ_API_KEY')
export const cerebrasApiKey = defineSecret('CEREBRAS_API_KEY')
export const langfusePublicKey = defineSecret('LANGFUSE_PUBLIC_KEY')
export const langfuseSecretKey = defineSecret('LANGFUSE_SECRET_KEY')
export const langfuseBaseUrl = defineSecret('LANGFUSE_BASE_URL')

// Singleton router (persists across warm invocations of the Cloud Function)
let router: LLMRouter | null = null

function getRouter(): LLMRouter {
  if (!router) {
    router = new LLMRouter()
      .addGemini(geminiApiKey.value())
      .addGroq(groqApiKey.value())
      .addCerebras(cerebrasApiKey.value())
  }
  return router
}

const MAX_RETRIES = 2

// Defense-in-depth: mismas reglas que en el cliente
// (`src/modules/agent/utils/image-validation.ts`).
const ALLOWED_IMAGE_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

const ALLOWED_DOC_MIMETYPES = ['application/pdf'] as const

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_PDF_BYTES = 10 * 1024 * 1024 // 10 MB
// base64 ≈ 4/3 del binario; agregamos margen por el prefijo `data:...;base64,`.
const MAX_IMAGE_DATA_URL_LENGTH = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 256
const MAX_PDF_DATA_URL_LENGTH = Math.ceil(MAX_PDF_BYTES * 4 / 3) + 256

type AttachmentValidationResult =
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> }

function validateAttachments(messages: unknown): AttachmentValidationResult {
  if (!Array.isArray(messages)) return { ok: true }

  try {
    for (const msg of messages) {
      if (!msg || typeof msg !== 'object') continue
      const attachments = (msg as Record<string, unknown>).experimental_attachments
      if (!Array.isArray(attachments)) continue

      for (const att of attachments) {
        if (!att || typeof att !== 'object') continue
        const contentType = (att as Record<string, unknown>).contentType
        const url = (att as Record<string, unknown>).url

        if (typeof contentType !== 'string') continue
        const mimetype = contentType.toLowerCase()

        if (mimetype.startsWith('image/')) {
          if (!(ALLOWED_IMAGE_MIMETYPES as readonly string[]).includes(mimetype)) {
            return {
              ok: false,
              status: 400,
              body: { error: 'unsupported_image_type', mimetype },
            }
          }
          if (typeof url === 'string' && url.length > MAX_IMAGE_DATA_URL_LENGTH) {
            return {
              ok: false,
              status: 400,
              body: { error: 'image_too_large' },
            }
          }
        } else if ((ALLOWED_DOC_MIMETYPES as readonly string[]).includes(mimetype)) {
          if (typeof url === 'string' && url.length > MAX_PDF_DATA_URL_LENGTH) {
            return {
              ok: false,
              status: 400,
              body: { error: 'pdf_too_large' },
            }
          }
        } else {
          continue
        }
      }
    }
  } catch (err) {
    // Si el shape no matchea (cliente viejo, formato distinto), no bloquear.
    console.warn('[AgentChat] validateAttachments skipped due to error:', err)
    return { ok: true }
  }

  return { ok: true }
}

export const agentChat = onRequest(
  {
    cors: true,
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [
      geminiApiKey,
      groqApiKey,
      cerebrasApiKey,
      langfusePublicKey,
      langfuseSecretKey,
      langfuseBaseUrl,
    ],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    try {
      const {
        messages,
        companyId,
        companies,
        userMemory,
        inlineContext,
        // Wave 4.2 — thread activo. Si vienen, se inyectan al system prompt
        // y la tool updateThreadState queda habilitada con el threadId.
        threadId,
        threadTitle,
        threadContext,
        nextActions,
        userId,
        conversationId,
      } = req.body

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: 'Invalid request: messages array required' })
        return
      }

      if (!companyId || typeof companyId !== 'string') {
        res.status(400).json({ error: 'Invalid request: companyId required' })
        return
      }

      // Defense-in-depth para imágenes adjuntas: tipo + tamaño.
      const attachmentCheck = validateAttachments(messages)
      if (!attachmentCheck.ok) {
        res.status(attachmentCheck.status).json(attachmentCheck.body)
        return
      }

      const safeThreadId = typeof threadId === 'string' ? threadId : undefined
      const tools = createAgentTools(companyId, safeThreadId)
      const needsVision = messagesContainImages(messages)
      const companyList = Array.isArray(companies) ? companies : []
      const hasImages = needsVision

      const lf = getLangfuseClient()
      const trace = lf?.trace({
        name: 'agent-chat',
        userId: typeof userId === 'string' ? userId : 'anonymous',
        sessionId: typeof conversationId === 'string'
          ? conversationId
          : (safeThreadId ?? undefined),
        metadata: { companyId, hasImages, threadId: safeThreadId },
        input: messages,
        tags: ['agent', `company:${companyId}`],
      })

      // Retry loop with automatic fallback
      let lastError: unknown = null
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const llmRouter = getRouter()
        let providerName = 'unknown'

        try {
          const { model, provider } = await llmRouter.getModel({ needsVision })
          providerName = provider
          console.log(`[AgentChat] Attempt ${attempt + 1} using ${provider}${needsVision ? ' (vision)' : ''}`)

          const generation = trace?.generation({
            name: 'streamText',
            model: provider,
            input: messages,
            metadata: { attempt: attempt + 1, needsVision },
          })

          const startedAt = Date.now()
          const result = streamText({
            model,
            system: getAgentSystemPrompt({
              companies: companyList,
              activeCompanyId: companyId,
              userMemory: userMemory ?? null,
              inlineContext: (inlineContext && typeof inlineContext === 'object')
                ? (inlineContext as Record<string, unknown>)
                : null,
              thread: typeof threadTitle === 'string' && threadTitle.trim().length > 0
                ? {
                    title: threadTitle,
                    context: (threadContext && typeof threadContext === 'object'
                      ? (threadContext as Record<string, unknown>)
                      : {}),
                    nextActions: Array.isArray(nextActions)
                      ? (nextActions as unknown[]).filter((a): a is string => typeof a === 'string')
                      : [],
                  }
                : null,
            }),
            messages,
            tools,
            maxSteps: 8,
            experimental_telemetry: {
              isEnabled: Boolean(trace),
              functionId: 'agent-chat',
              metadata: {
                langfuseTraceId: trace?.id ?? '',
                langfuseUpdateParent: false,
                companyId,
                provider,
              },
            },
            onFinish: async (event) => {
              try {
                const usage = (event as { usage?: Record<string, unknown> }).usage
                const text = (event as { text?: string }).text
                const finishReason = (event as { finishReason?: string }).finishReason
                const toolCalls = (event as { toolCalls?: unknown }).toolCalls
                const toolResults = (event as { toolResults?: unknown }).toolResults
                generation?.end({
                  output: { text, toolCalls, toolResults, finishReason },
                  usage: usage as never,
                  metadata: {
                    latencyMs: Date.now() - startedAt,
                    finishReason,
                  },
                })
                trace?.update({
                  output: { text, finishReason },
                  metadata: { provider, latencyMs: Date.now() - startedAt },
                })
              } catch (err) {
                console.warn('[langfuse] onFinish hook failed:', err)
              } finally {
                await flushLangfuse(lf)
              }
            },
            onError: async (event) => {
              const err = (event as { error?: unknown }).error ?? event
              const message = err instanceof Error ? err.message : String(err)
              try {
                generation?.end({
                  output: { error: message },
                  level: 'ERROR',
                  statusMessage: message,
                })
                trace?.update({
                  output: { error: message },
                  metadata: { provider, latencyMs: Date.now() - startedAt },
                })
              } catch (e) {
                console.warn('[langfuse] onError hook failed:', e)
              } finally {
                await flushLangfuse(lf)
              }
            },
          })

          result.pipeDataStreamToResponse(res)
          return
        } catch (error: unknown) {
          lastError = error

          if (isRateLimitError(error)) {
            const cooldown = parseRetryAfter(error)
            await llmRouter.markRateLimited(providerName, cooldown)
            trace?.event({
              name: 'rate-limited',
              input: { provider: providerName, cooldownMs: cooldown },
              level: 'WARNING',
            })
            console.warn(`[AgentChat] ${providerName} rate limited, retrying with fallback...`)
            continue
          }

          trace?.update({
            output: { error: error instanceof Error ? error.message : String(error) },
            metadata: { provider: providerName },
          })
          await flushLangfuse(lf)
          throw error
        }
      }

      console.error('[AgentChat] All providers failed:', lastError)
      trace?.update({
        output: { error: 'all_providers_rate_limited' },
      })
      await flushLangfuse(lf)
      res.status(503).json({
        error: 'Todos los proveedores de AI están temporalmente limitados. Intenta de nuevo en un minuto.',
      })
    } catch (error: unknown) {
      console.error('Agent chat error:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  }
)
