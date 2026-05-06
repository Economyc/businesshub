import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { streamText } from 'ai'
import { getAgentSystemPrompt } from './system-prompt.js'
import { createAgentTools } from './tools/index.js'
import { LLMRouter, isRateLimitError, parseRetryAfter, messagesContainImages } from './llm-router.js'

const geminiApiKey = defineSecret('GEMINI_API_KEY')
const cerebrasApiKey = defineSecret('CEREBRAS_API_KEY')

// Singleton router (persists across warm invocations of the Cloud Function)
let router: LLMRouter | null = null

function getRouter(): LLMRouter {
  if (!router) {
    router = new LLMRouter()
      .addGemini(geminiApiKey.value())
      .addCerebras(cerebrasApiKey.value())
    // Groq can be added later when key is available
    // .addGroq(groqApiKey.value())
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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
// base64 ≈ 4/3 del binario; agregamos margen por el prefijo `data:...;base64,`.
const MAX_IMAGE_DATA_URL_LENGTH = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 256

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

        if (typeof contentType !== 'string' || !contentType.startsWith('image/')) {
          continue
        }

        const mimetype = contentType.toLowerCase()
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
    secrets: [geminiApiKey, cerebrasApiKey],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    try {
      const { messages, companyId, companies, userMemory } = req.body

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

      const tools = createAgentTools(companyId)
      const needsVision = messagesContainImages(messages)
      const companyList = Array.isArray(companies) ? companies : []

      // Retry loop with automatic fallback
      let lastError: unknown = null
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const llmRouter = getRouter()
        let providerName = 'unknown'

        try {
          const { model, provider } = await llmRouter.getModel({ needsVision })
          providerName = provider
          console.log(`[AgentChat] Attempt ${attempt + 1} using ${provider}${needsVision ? ' (vision)' : ''}`)

          const result = streamText({
            model,
            system: getAgentSystemPrompt({
              companies: companyList,
              activeCompanyId: companyId,
              userMemory: userMemory ?? null,
            }),
            messages,
            tools,
            maxSteps: 8,
          })

          result.pipeDataStreamToResponse(res)
          return
        } catch (error: unknown) {
          lastError = error

          if (isRateLimitError(error)) {
            const cooldown = parseRetryAfter(error)
            await llmRouter.markRateLimited(providerName, cooldown)
            console.warn(`[AgentChat] ${providerName} rate limited, retrying with fallback...`)
            continue
          }

          throw error
        }
      }

      console.error('[AgentChat] All providers failed:', lastError)
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
