import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createCerebras } from '@ai-sdk/cerebras'
import type { LanguageModelV1 } from 'ai'
import { Timestamp } from 'firebase-admin/firestore'
import { db } from './firestore.js'

interface ProviderConfig {
  name: string
  createModel: () => LanguageModelV1
  supportsVision: boolean
  /** True si el provider puede leer PDFs como input vision nativo (Gemini sí, Groq Scout no). */
  supportsPdfNative: boolean
  /** Default cooldown in ms when 429 is received and no Retry-After is given. */
  defaultCooldownMs: number
}

interface RateLimitEntry {
  /** Epoch ms hasta que el provider sigue rate-limited. */
  until: number
  /** Cuándo se leyó/escribió este valor en el cache local. */
  cachedAt: number
}

/** Doc shape persisted in Firestore. */
interface RateLimitDoc {
  provider: string
  until: Timestamp
  reason?: string
  updatedAt: Timestamp
}

const RATE_LIMIT_COLLECTION_PARENT = 'system'
const RATE_LIMIT_PARENT_DOC = 'llm-rate-limits'
const RATE_LIMIT_SUBCOLLECTION = 'providers'

/** TTL del cache en memoria para evitar pegarle a Firestore en cada request. */
const LOCAL_CACHE_TTL_MS = 30_000

/** Cooldowns por provider cuando no hay Retry-After. */
const DEFAULT_COOLDOWNS: Record<string, number> = {
  gemini: 60_000,
  'groq-qwen': 30_000,
  'groq-gptoss': 30_000,
  'cerebras-gptoss': 60_000,
}

function rateLimitDocRef(providerName: string) {
  return db
    .collection(RATE_LIMIT_COLLECTION_PARENT)
    .doc(RATE_LIMIT_PARENT_DOC)
    .collection(RATE_LIMIT_SUBCOLLECTION)
    .doc(providerName)
}

/**
 * LLM Router with automatic fallback between free providers.
 * Persists rate limits in Firestore so cooldowns survive cold starts; keeps a short
 * in-memory cache (30s TTL) and an in-memory fallback if Firestore is unreachable.
 */
export class LLMRouter {
  private providers: ProviderConfig[] = []
  /** Cache local: provider → { until, cachedAt }. También sirve de fallback. */
  private cache: Map<string, RateLimitEntry> = new Map()

  addGemini(apiKey: string) {
    if (!apiKey) return this
    const google = createGoogleGenerativeAI({ apiKey })
    this.providers.push({
      name: 'gemini',
      createModel: () => google('gemini-2.5-flash'),
      supportsVision: true,
      supportsPdfNative: true,
      defaultCooldownMs: DEFAULT_COOLDOWNS.gemini,
    })
    return this
  }

  addGroq(apiKey: string) {
    if (!apiKey) return this
    const groq = createGroq({ apiKey })
    // Groq retiró toda la familia Llama de su catálogo (2026-08): se fueron
    // llama-4-scout (visión) y llama-3.3-70b-versatile (texto). Los vigentes son
    // qwen3.6 para visión y gpt-oss-120b para texto.
    //
    // Vision-capable model first. Igual que Scout, qwen NO lee PDFs vía API —
    // solo imágenes como image_url. Si llega un PDF, el router lo salta.
    // OJO: qwen3.6 es un modelo de razonamiento y emite el reasoning en un campo
    // aparte. NO ponerle un maxTokens bajo o el JSON estructurado sale vacío.
    this.providers.push({
      name: 'groq-qwen',
      createModel: () => groq('qwen/qwen3.6-27b'),
      supportsVision: true,
      supportsPdfNative: false,
      defaultCooldownMs: DEFAULT_COOLDOWNS['groq-qwen'],
    })
    // Text-only model como fallback adicional
    this.providers.push({
      name: 'groq-gptoss',
      createModel: () => groq('openai/gpt-oss-120b'),
      supportsVision: false,
      supportsPdfNative: false,
      defaultCooldownMs: DEFAULT_COOLDOWNS['groq-gptoss'],
    })
    return this
  }

  addCerebras(apiKey: string) {
    if (!apiKey) return this
    const cerebras = createCerebras({ apiKey })
    // Cerebras retiró llama-3.1-8b de su catálogo (2026-06); gpt-oss-120b es
    // el modelo de texto vigente en su free tier.
    this.providers.push({
      name: 'cerebras-gptoss',
      createModel: () => cerebras('gpt-oss-120b'),
      supportsVision: false,
      supportsPdfNative: false,
      defaultCooldownMs: DEFAULT_COOLDOWNS['cerebras-gptoss'],
    })
    return this
  }

  /**
   * Lee el estado de rate-limit de todos los providers (cache local + Firestore en paralelo).
   * Si Firestore falla, cae al cache local existente. Nunca rompe el chat.
   */
  private async loadRateLimits(): Promise<Map<string, number>> {
    const now = Date.now()
    const result = new Map<string, number>()
    const providersToFetch: string[] = []

    for (const provider of this.providers) {
      const cached = this.cache.get(provider.name)
      if (cached && now - cached.cachedAt < LOCAL_CACHE_TTL_MS) {
        result.set(provider.name, cached.until)
      } else {
        providersToFetch.push(provider.name)
      }
    }

    if (providersToFetch.length === 0) return result

    try {
      const snaps = await Promise.all(
        providersToFetch.map((name) => rateLimitDocRef(name).get()),
      )
      for (let i = 0; i < providersToFetch.length; i++) {
        const name = providersToFetch[i]
        const snap = snaps[i]
        let until = 0
        if (snap.exists) {
          const data = snap.data() as Partial<RateLimitDoc> | undefined
          const ts = data?.until
          if (ts && typeof (ts as Timestamp).toMillis === 'function') {
            until = (ts as Timestamp).toMillis()
          }
        }
        this.cache.set(name, { until, cachedAt: now })
        result.set(name, until)
      }
    } catch (error) {
      console.warn('[LLMRouter] Firestore read failed, using in-memory fallback:', error)
      // Fallback: usar lo que haya en cache (aunque esté stale) o 0.
      for (const name of providersToFetch) {
        const cached = this.cache.get(name)
        result.set(name, cached?.until ?? 0)
      }
    }

    return result
  }

  /**
   * Get the best available model. Skips rate-limited providers.
   * If the request includes images, only returns vision-capable models.
   * Si needsPdfNative=true, solo devuelve providers que pueden leer PDFs como input
   * (excluye groq-qwen que solo lee imágenes).
   * Si `exclude` está presente, salta esos providers (útil para iterar dentro de una
   * misma request sin marcarlos rate-limited).
   */
  async getModel(options?: {
    needsVision?: boolean
    needsPdfNative?: boolean
    exclude?: ReadonlySet<string>
  }): Promise<{ model: LanguageModelV1; provider: string }> {
    const now = Date.now()
    const needsVision = options?.needsVision ?? false
    const needsPdfNative = options?.needsPdfNative ?? false
    const exclude = options?.exclude
    const rateLimits = await this.loadRateLimits()

    for (const provider of this.providers) {
      if (exclude?.has(provider.name)) continue
      const until = rateLimits.get(provider.name) ?? 0
      if (until > now) {
        console.log(`[LLMRouter] Skipping ${provider.name} (rate limited until ${new Date(until).toISOString()})`)
        continue
      }
      if (needsVision && !provider.supportsVision) {
        continue
      }
      if (needsPdfNative && !provider.supportsPdfNative) {
        continue
      }
      return { model: provider.createModel(), provider: provider.name }
    }

    throw new Error('All AI providers are rate-limited or unavailable. Please try again in a minute.')
  }

  /**
   * Mark a provider as rate-limited. Persiste en Firestore + actualiza cache local.
   * Si Firestore falla, mantiene el rate-limit sólo en memoria (fallback silencioso).
   */
  async markRateLimited(providerName: string, cooldownMs?: number, reason?: string): Promise<void> {
    const provider = this.providers.find((p) => p.name === providerName)
    if (!provider) return

    const effectiveCooldown = cooldownMs ?? provider.defaultCooldownMs ?? 60_000
    const untilMs = Date.now() + effectiveCooldown

    // Cache local primero (sirve de fallback si Firestore falla).
    this.cache.set(providerName, { until: untilMs, cachedAt: Date.now() })

    try {
      const payload: RateLimitDoc = {
        provider: providerName,
        until: Timestamp.fromMillis(untilMs),
        updatedAt: Timestamp.now(),
        ...(reason ? { reason } : {}),
      }
      await rateLimitDocRef(providerName).set(payload, { merge: true })
      console.warn(`[LLMRouter] ${providerName} rate limited for ${effectiveCooldown}ms (persisted)`)
    } catch (error) {
      console.warn(
        `[LLMRouter] Failed to persist rate limit for ${providerName}, keeping in-memory only:`,
        error,
      )
    }
  }

  /**
   * Get status of all providers for debugging.
   */
  async getStatus() {
    const now = Date.now()
    const rateLimits = await this.loadRateLimits()
    return this.providers.map((p) => {
      const until = rateLimits.get(p.name) ?? 0
      return {
        name: p.name,
        available: until <= now,
        supportsVision: p.supportsVision,
        cooldownRemaining: Math.max(0, until - now),
      }
    })
  }
}

/**
 * Detecta errores de "no hay saldo / créditos agotados / sin quota prepagada".
 * Estos NO se recuperan en minutos — necesitan acción manual (topup). Cuando
 * pasan aplicamos un cooldown largo para no quemar el chain entero en cada
 * request mientras el dueño recarga.
 */
export function isCreditDepletedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('prepayment credits are depleted') ||
    msg.includes('credits are depleted') ||
    msg.includes('credits depleted') ||
    msg.includes('insufficient funds') ||
    msg.includes('insufficient_quota') ||
    msg.includes('billing account')
  )
}

/**
 * Check if a streamText error is a rate limit error (HTTP 429).
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota')) {
      return true
    }
  }
  if (typeof error === 'object' && error !== null) {
    const statusCode = (error as Record<string, unknown>).status ?? (error as Record<string, unknown>).statusCode
    if (statusCode === 429) return true
  }
  return false
}

/**
 * Parse retry-after header from error, returns milliseconds.
 */
export function parseRetryAfter(error: unknown): number {
  if (typeof error === 'object' && error !== null) {
    const headers = (error as Record<string, unknown>).headers as Record<string, string> | undefined
    const retryAfter = headers?.['retry-after']
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10)
      if (!isNaN(seconds)) return seconds * 1000
    }
  }
  return 60_000 // Default 1 minute
}

/**
 * Check if messages contain image content (for vision routing).
 */
export function messagesContainImages(messages: unknown[]): boolean {
  for (const msg of messages) {
    if (typeof msg !== 'object' || msg === null) continue
    const content = (msg as Record<string, unknown>).content
    if (Array.isArray(content)) {
      for (const part of content) {
        if (typeof part === 'object' && part !== null) {
          const type = (part as Record<string, unknown>).type
          if (type === 'image' || type === 'file') return true
        }
      }
    }
  }
  return false
}
