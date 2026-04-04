import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { streamText } from 'ai'
import { getAgentSystemPrompt } from './system-prompt.js'
import { createAgentTools } from './tools/index.js'
import { LLMRouter, isRateLimitError, parseRetryAfter, messagesContainImages } from './llm-router.js'

const geminiApiKey = defineSecret('GEMINI_API_KEY')

// Singleton router (persists across warm invocations of the Cloud Function)
let router: LLMRouter | null = null

function getRouter(): LLMRouter {
  if (!router) {
    router = new LLMRouter()
      .addGemini(geminiApiKey.value())
    // Groq and Cerebras can be added later when keys are available
    // .addGroq(groqApiKey.value())
  }
  return router
}

const MAX_RETRIES = 2

export const agentChat = onRequest(
  {
    cors: true,
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [geminiApiKey],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    try {
      const { messages, companyId } = req.body

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: 'Invalid request: messages array required' })
        return
      }

      if (!companyId || typeof companyId !== 'string') {
        res.status(400).json({ error: 'Invalid request: companyId required' })
        return
      }

      const tools = createAgentTools(companyId)
      const needsVision = messagesContainImages(messages)

      // Retry loop with automatic fallback
      let lastError: unknown = null
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const llmRouter = getRouter()
        let providerName = 'unknown'

        try {
          const { model, provider } = llmRouter.getModel({ needsVision })
          providerName = provider
          console.log(`[AgentChat] Attempt ${attempt + 1} using ${provider}${needsVision ? ' (vision)' : ''}`)

          const result = streamText({
            model,
            system: getAgentSystemPrompt(),
            messages,
            tools,
            maxSteps: 5,
          })

          result.pipeDataStreamToResponse(res)
          return
        } catch (error: unknown) {
          lastError = error

          if (isRateLimitError(error)) {
            const cooldown = parseRetryAfter(error)
            llmRouter.markRateLimited(providerName, cooldown)
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
