// Helper genérico de extracción estructurada con cadena de fallback.
// Estrategia (orden de intento):
//   Fase 1 — Vision providers (Gemini, Groq Scout):
//     * Gemini recibe el archivo como { type: 'file' } (PDF o imagen).
//     * Groq Scout sólo se usa para imágenes (no soporta PDFs nativos) y
//       recibe el contenido como { type: 'image' } con data URL base64.
//   Fase 2 — Si el archivo es PDF y la fase 1 falló:
//     * pdf-parse extrae texto embebido → Cerebras / Groq-llama70b lo procesan.
//     * Si pdf-parse no devuelve texto (PDF escaneado), Cloud Vision PDF OCR
//       extrae texto como último recurso → text-only providers.
//   Fase 3 — Si el archivo es imagen y la fase 1 falló:
//     * Google Cloud Vision OCR extrae texto → text-only providers
//       (Cerebras / Groq-llama70b) lo procesan.
//   Si todo falla → ExtractionFailedError con detalle por proveedor.
//
// El caller decide qué hacer con el error: típicamente devuelve
// extractionFailed=true al cliente para que muestre toast y permita
// llenar manualmente.

import { generateObject, type CoreUserMessage } from 'ai'
import type { z } from 'zod'
import {
  LLMRouter,
  isRateLimitError,
  isCreditDepletedError,
  isDailyQuotaError,
  msUntilPacificMidnight,
  parseRetryAfter,
} from './llm-router.js'
import { ocrImageBase64, ocrPdfBase64 } from './cloud-vision-ocr.js'
import { recordUsage, providerToField } from './ai-usage-stats.js'

interface ExtractParams<T> {
  router: LLMRouter
  schema: z.ZodSchema<T>
  /** Prompt de extracción (sin el archivo). El helper agrega el archivo o el texto del PDF. */
  prompt: string
  fileBase64: string
  mimeType: string
  /** Máximo de proveedores vision a intentar antes de caer a text-only. Default 3. */
  maxVisionAttempts?: number
  /** Máximo de proveedores text-only a intentar (PDF text o image OCR). Default 3. */
  maxTextAttempts?: number
  /**
   * Predicado opcional: ¿la extracción salió "vacía" (sin datos útiles)?
   * Si se provee y un PDF leído con pdf-parse da un resultado vacío, el helper
   * escala a Cloud Vision OCR (texto mejor maquetado) y reintenta, en vez de
   * devolver el vacío. También se usa al final para lanzar (en vez de devolver
   * vacío) y que el caller muestre el aviso de fallo. Default: nunca vacío.
   */
  isResultEmpty?: (obj: T) => boolean
}

interface ExtractResult<T> {
  object: T
  /** Provider que tuvo éxito. Ej: 'gemini', 'groq-qwen', 'groq-gptoss+pdf-parse', 'cerebras-gptoss+vision-ocr' */
  provider: string
  /** True si tuvo que caer a un proveedor secundario (no fue el primario). */
  fallbackUsed: boolean
}

interface AttemptRecord {
  provider: string
  error: string
}

export class ExtractionFailedError extends Error {
  constructor(public attempts: AttemptRecord[]) {
    const summary = attempts.map((a) => `${a.provider}: ${a.error}`).join(' | ')
    super(`All AI providers failed: ${summary}`)
    this.name = 'ExtractionFailedError'
  }
}

/** Cooldown largo cuando un provider se quedó sin créditos prepagados. */
const CREDITS_DEPLETED_COOLDOWN_MS = 6 * 60 * 60 * 1000 // 6 horas

/**
 * Traduce un fallo total de la cadena a un motivo entendible por el usuario.
 * Sin esto el cliente sólo puede decir "no se pudo leer", y una caída por saldo
 * o por un modelo retirado se ve igual que un documento borroso — que fue
 * exactamente lo que dejó el lector roto durante 5 días sin que nadie lo notara.
 */
export function describeExtractionFailure(err: unknown): string {
  const attempts = err instanceof ExtractionFailedError ? err.attempts : []
  const errors = attempts.map((a) => new Error(a.error))

  if (errors.some(isCreditDepletedError)) {
    return 'El servicio de IA se quedó sin saldo. Avísale al administrador para que lo recargue.'
  }
  if (errors.some((e) => /does not exist|do not have access|not found/i.test(e.message))) {
    return 'El modelo de IA configurado ya no está disponible y hay que actualizarlo.'
  }
  if (errors.some(isRateLimitError)) {
    return 'El servicio de IA alcanzó su límite de uso. Intenta de nuevo en unos minutos.'
  }
  const msg = err instanceof Error ? err.message : ''
  if (/rate-limited or unavailable/i.test(msg)) {
    return 'Todos los proveedores de IA están temporalmente fuera de servicio. Intenta más tarde.'
  }
  return 'No pudimos leer el documento. Puede estar borroso o en un formato que la IA no entiende.'
}

/** Telemetría fire-and-forget de éxito por provider. No bloquea la respuesta. */
function trackSuccess(provider: string): void {
  const field = providerToField(provider)
  if (field) void recordUsage(field)
  void recordUsage('totalExtractions')
}

/** Telemetría fire-and-forget de fallo total del chain. */
function trackFailure(): void {
  void recordUsage('totalFailed')
}

/**
 * Construye el content array para `generateObject` según el provider y el tipo
 * de archivo. Groq y Gemini esperan formatos distintos.
 */
function buildContent(
  provider: string,
  prompt: string,
  fileBase64: string,
  mimeType: string,
): CoreUserMessage['content'] {
  // Groq sólo entiende imágenes vía content type 'image' con data URL.
  if (provider === 'groq-qwen') {
    return [
      { type: 'text', text: prompt },
      { type: 'image', image: `data:${mimeType};base64,${fileBase64}` },
    ]
  }
  // Gemini (y cualquier otro provider que se agregue con file-input nativo).
  return [
    { type: 'text', text: prompt },
    { type: 'file', data: fileBase64, mimeType },
  ]
}

/**
 * Llama a un provider text-only con un prompt + texto adjunto y devuelve el resultado
 * parseado por el schema. Maneja rate-limit y errores de créditos.
 */
async function tryTextOnlyProviders<T>(
  router: LLMRouter,
  schema: z.ZodSchema<T>,
  prompt: string,
  textBody: string,
  textSourceLabel: 'pdf-parse' | 'vision-ocr',
  maxAttempts: number,
  attempts: AttemptRecord[],
): Promise<{ object: T; provider: string } | null> {
  const tried = new Set<string>()
  for (let i = 0; i < maxAttempts; i++) {
    let modelInfo
    try {
      modelInfo = await router.getModel({ needsVision: false, exclude: tried })
    } catch {
      break
    }
    tried.add(modelInfo.provider)

    try {
      const result = await generateObject({
        model: modelInfo.model,
        schema,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\nTexto extraído (puede estar desordenado por columnas):\n\n${textBody}`,
          },
        ],
      })
      trackSuccess(modelInfo.provider)
      return {
        object: result.object,
        provider: `${modelInfo.provider}+${textSourceLabel}`,
      }
    } catch (err) {
      const errMsg = (err as Error).message ?? String(err)
      attempts.push({ provider: modelInfo.provider, error: errMsg })
      console.warn(`[extractWithFallback] ${modelInfo.provider} (text) failed:`, errMsg)

      if (isCreditDepletedError(err)) {
        await router.markRateLimited(
          modelInfo.provider,
          CREDITS_DEPLETED_COOLDOWN_MS,
          'credits depleted',
        )
        continue
      }
      if (isRateLimitError(err)) {
        // Un 429 por cuota DIARIA no se recupera en un minuto: si lo tratamos
        // como límite por minuto, cada lectura del resto del día quema un
        // intento condenado a fallar antes de pasar al siguiente provider.
        const daily = isDailyQuotaError(err)
        await router.markRateLimited(
          modelInfo.provider,
          daily ? msUntilPacificMidnight() : parseRetryAfter(err),
          daily ? 'cuota diaria agotada' : 'extraction 429',
        )
        continue
      }
      await router.markRateLimited(modelInfo.provider, 30_000, 'extraction error')
    }
  }
  return null
}

/**
 * Intenta extraer datos estructurados de un archivo (imagen o PDF) usando
 * la cadena Gemini → Groq Scout (sólo imágenes) → (PDF) pdf-parse → text-only
 *                                                → (imagen) Cloud Vision OCR → text-only.
 *
 * Lanza ExtractionFailedError si todos los proveedores fallan.
 */
export async function extractWithFallback<T>(
  params: ExtractParams<T>,
): Promise<ExtractResult<T>> {
  const {
    router,
    schema,
    prompt,
    fileBase64,
    mimeType,
    maxVisionAttempts = 3,
    maxTextAttempts = 3,
    isResultEmpty = () => false,
  } = params

  const isPdf = mimeType === 'application/pdf'
  const isImage = mimeType.startsWith('image/')
  const attempts: AttemptRecord[] = []
  let isPrimary = true

  // ── Fase 1: vision providers ──────────────────────────────────────
  const triedVision = new Set<string>()
  for (let i = 0; i < maxVisionAttempts; i++) {
    let modelInfo
    try {
      modelInfo = await router.getModel({
        needsVision: true,
        // Si es PDF, sólo aceptamos providers con soporte PDF nativo (Gemini).
        needsPdfNative: isPdf,
        exclude: triedVision,
      })
    } catch {
      // No quedan vision providers viables — pasar a fase 2/3.
      break
    }
    triedVision.add(modelInfo.provider)

    try {
      const result = await generateObject({
        model: modelInfo.model,
        schema,
        messages: [
          {
            role: 'user',
            content: buildContent(modelInfo.provider, prompt, fileBase64, mimeType),
          },
        ],
      })
      trackSuccess(modelInfo.provider)
      return {
        object: result.object,
        provider: modelInfo.provider,
        fallbackUsed: !isPrimary,
      }
    } catch (err) {
      const errMsg = (err as Error).message ?? String(err)
      attempts.push({ provider: modelInfo.provider, error: errMsg })
      console.warn(`[extractWithFallback] ${modelInfo.provider} failed:`, errMsg)

      if (isCreditDepletedError(err)) {
        await router.markRateLimited(
          modelInfo.provider,
          CREDITS_DEPLETED_COOLDOWN_MS,
          'credits depleted',
        )
        isPrimary = false
        continue
      }
      if (isRateLimitError(err)) {
        // Un 429 por cuota DIARIA no se recupera en un minuto: si lo tratamos
        // como límite por minuto, cada lectura del resto del día quema un
        // intento condenado a fallar antes de pasar al siguiente provider.
        const daily = isDailyQuotaError(err)
        await router.markRateLimited(
          modelInfo.provider,
          daily ? msUntilPacificMidnight() : parseRetryAfter(err),
          daily ? 'cuota diaria agotada' : 'extraction 429',
        )
        isPrimary = false
        continue
      }
      // Para errores no-429 (safety filter, schema mismatch, timeout) también
      // marcamos cooldown corto para no quemar el provider en cada request.
      await router.markRateLimited(modelInfo.provider, 30_000, 'extraction error')
      isPrimary = false
    }
  }

  // ── Fase 2: PDF → texto → text-only providers ─────────────────────
  // Orden: pdf-parse (local, gratis) primero; si su texto no alcanza para
  // extraer datos (PDF escaneado, o texto mal maquetado por columnas que
  // confunde al modelo), escalamos a Cloud Vision OCR (texto mejor ordenado)
  // y reintentamos. Cloud Vision SOLO se usa cuando pdf-parse no dio resultado
  // útil — así no se gasta OCR cuando no hace falta.
  if (isPdf) {
    // 2a — texto embebido vía pdf-parse. La mayoría de facturas genéricas son
    // PDFs con texto, así que esto las resuelve sin tocar Cloud Vision.
    let pdfText = ''
    try {
      // Import dinámico para no penalizar cold start cuando solo es imagen.
      const { PDFParse } = await import('pdf-parse')
      const buffer = Buffer.from(fileBase64, 'base64')
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      try {
        const result = await parser.getText()
        pdfText = (result.text ?? '').trim()
      } finally {
        // Liberar el parser aunque getText() lance (PDF corrupto/cifrado).
        await parser.destroy()
      }
    } catch (err) {
      const errMsg = (err as Error).message ?? String(err)
      attempts.push({ provider: 'pdf-parse', error: errMsg })
      // No lanzamos: caemos a Cloud Vision OCR abajo.
    }

    if (pdfText) {
      // Truncar texto muy largo para no exceder context windows pequeños (Cerebras 8B = 8K tokens).
      const truncated = pdfText.length > 20_000 ? pdfText.slice(0, 20_000) + '\n[...truncado]' : pdfText
      const success = await tryTextOnlyProviders(
        router,
        schema,
        prompt,
        truncated,
        'pdf-parse',
        maxTextAttempts,
        attempts,
      )
      if (success && !isResultEmpty(success.object)) {
        return { object: success.object, provider: success.provider, fallbackUsed: true }
      }
      // pdf-parse dio texto pero el modelo no extrajo datos (texto pobre o mal
      // maquetado). Escalamos a Cloud Vision OCR para reintentar con texto mejor.
      if (success) {
        attempts.push({
          provider: 'pdf-parse',
          error: 'extracción vacía (texto mal maquetado), escalando a Cloud Vision OCR',
        })
        console.warn('[extractWithFallback] pdf-parse dio extracción vacía, escalando a Cloud Vision OCR')
      }
    }

    // 2b — Cloud Vision OCR: PDF escaneado (pdf-parse vacío) o texto pobre
    // (extracción vacía). Da texto mejor maquetado → reintento.
    void recordUsage('cloudVisionOcr')
    let ocrText: string
    try {
      ocrText = await ocrPdfBase64(fileBase64)
    } catch (err) {
      const errMsg = (err as Error).message ?? String(err)
      attempts.push({ provider: 'cloud-vision-ocr', error: errMsg })
      trackFailure()
      throw new ExtractionFailedError(attempts)
    }

    if (!ocrText) {
      attempts.push({
        provider: 'cloud-vision-ocr',
        error: 'PDF sin texto detectable por OCR',
      })
      trackFailure()
      throw new ExtractionFailedError(attempts)
    }

    const truncated = ocrText.length > 20_000 ? ocrText.slice(0, 20_000) + '\n[...truncado]' : ocrText
    const success = await tryTextOnlyProviders(
      router,
      schema,
      prompt,
      truncated,
      'vision-ocr',
      maxTextAttempts,
      attempts,
    )
    if (success && !isResultEmpty(success.object)) {
      return { object: success.object, provider: success.provider, fallbackUsed: true }
    }
    // Ni con OCR salieron datos → fallo real (el caller muestra el aviso).
    if (success) {
      attempts.push({ provider: 'vision-ocr', error: 'extracción vacía aun con OCR' })
    }
    trackFailure()
    throw new ExtractionFailedError(attempts)
  }

  // ── Fase 3: imagen → Cloud Vision OCR → text-only providers ───────
  if (isImage) {
    let ocrText: string
    // Contamos contra el free tier antes de invocar — si el shot va a llegar
    // a Cloud Vision aunque luego falle el parsing, igual nos cobra el OCR.
    void recordUsage('cloudVisionOcr')
    try {
      ocrText = await ocrImageBase64(fileBase64)
    } catch (err) {
      const errMsg = (err as Error).message ?? String(err)
      attempts.push({ provider: 'cloud-vision-ocr', error: errMsg })
      trackFailure()
      throw new ExtractionFailedError(attempts)
    }

    if (!ocrText) {
      attempts.push({
        provider: 'cloud-vision-ocr',
        error: 'Imagen sin texto detectable',
      })
      trackFailure()
      throw new ExtractionFailedError(attempts)
    }

    const truncated = ocrText.length > 20_000 ? ocrText.slice(0, 20_000) + '\n[...truncado]' : ocrText
    const success = await tryTextOnlyProviders(
      router,
      schema,
      prompt,
      truncated,
      'vision-ocr',
      maxTextAttempts,
      attempts,
    )
    if (success) {
      return { object: success.object, provider: success.provider, fallbackUsed: true }
    }
    trackFailure()
    throw new ExtractionFailedError(attempts)
  }

  trackFailure()
  throw new ExtractionFailedError(attempts)
}
