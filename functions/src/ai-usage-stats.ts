// Telemetría mensual de uso de proveedores IA en la cadena de extracción.
//
// Se guarda un único doc por mes en `system/ai-usage/months/{YYYY-MM}` con
// contadores atómicos (`FieldValue.increment`). El free tier global de
// Cloud Vision OCR (1000/mes por proyecto) es lo único con un límite
// público y consultable, por eso es el contador "destacado" en UI. Para
// los demás providers reportamos uso del mes sin pretender "remaining".

import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { db } from './firestore.js'

export type UsageField =
  | 'cloudVisionOcr'
  | 'geminiExtractions'
  | 'geminiPaidExtractions'
  | 'groqScoutExtractions'
  | 'cerebrasTextExtractions'
  | 'groqLlama70bExtractions'
  | 'totalExtractions'
  | 'totalFailed'

export interface UsageSnapshot {
  monthKey: string
  monthLabel: string
  cloudVisionOcrUsed: number
  cloudVisionFreeMonthly: number
  cloudVisionRemaining: number
  cloudVisionOverFreeTier: boolean
  /**
   * Claves heredadas de los modelos originales. Se conservan tal cual porque el
   * histórico mensual y los clientes (App1/Ecore) las leen así; hoy 'groq-scout'
   * cuenta a groq-qwen y 'groq-llama70b' a groq-gptoss.
   */
  byProvider: {
    gemini: number
    /** Lecturas que resolvió la key de Google con facturación. */
    'gemini-paid': number
    'groq-scout': number
    'cerebras-llama8b': number
    'groq-llama70b': number
  }
  totalExtractions: number
  totalFailed: number
}

const FREE_TIER_CLOUD_VISION = 1000

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function currentMonthKey(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function currentMonthLabel(now: Date = new Date()): string {
  return `${MONTH_NAMES_ES[now.getMonth()]} ${now.getFullYear()}`
}

function monthDocRef(monthKey: string) {
  return db.collection('system').doc('ai-usage').collection('months').doc(monthKey)
}

/**
 * Mapeo provider de LLMRouter → campo del doc. Devuelve null si el provider
 * no tiene contador propio (no debería pasar en runtime).
 */
export function providerToField(provider: string): UsageField | null {
  switch (provider) {
    case 'gemini':
      return 'geminiExtractions'
    case 'gemini-paid':
      return 'geminiPaidExtractions'
    // Los nombres de provider cambian cuando el proveedor retira un modelo;
    // los campos del doc se mantienen para no partir el histórico mensual.
    case 'groq-qwen':
      return 'groqScoutExtractions'
    case 'cerebras-llama8b':
      return 'cerebrasTextExtractions'
    case 'groq-gptoss':
      return 'groqLlama70bExtractions'
    default:
      return null
  }
}

/**
 * Incrementa un contador del mes actual. Fire-and-forget: si Firestore falla
 * solo se logea, no se propaga el error. Nunca debe romper la extracción.
 */
export function recordUsage(field: UsageField, by = 1): Promise<void> {
  const key = currentMonthKey()
  return monthDocRef(key)
    .set(
      {
        [field]: FieldValue.increment(by),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    )
    .catch((err) => {
      console.warn(`[ai-usage-stats] recordUsage(${field}) failed:`, err)
    })
    .then(() => undefined)
}

/**
 * Lee el snapshot del mes actual. Si el doc no existe, devuelve ceros.
 * Lanza solo si Firestore tira un error transitorio — el caller decide
 * (típicamente seguimos devolviendo la respuesta sin `usage`).
 */
export async function getUsageSnapshot(): Promise<UsageSnapshot> {
  const monthKey = currentMonthKey()
  const monthLabel = currentMonthLabel()
  const snap = await monthDocRef(monthKey).get()
  const d = (snap.exists ? snap.data() : {}) as Partial<Record<UsageField, number>>

  const cloudVisionOcrUsed = d.cloudVisionOcr ?? 0
  const remaining = Math.max(0, FREE_TIER_CLOUD_VISION - cloudVisionOcrUsed)

  return {
    monthKey,
    monthLabel,
    cloudVisionOcrUsed,
    cloudVisionFreeMonthly: FREE_TIER_CLOUD_VISION,
    cloudVisionRemaining: remaining,
    cloudVisionOverFreeTier: cloudVisionOcrUsed >= FREE_TIER_CLOUD_VISION,
    byProvider: {
      gemini: d.geminiExtractions ?? 0,
      'gemini-paid': d.geminiPaidExtractions ?? 0,
      'groq-scout': d.groqScoutExtractions ?? 0,
      'cerebras-llama8b': d.cerebrasTextExtractions ?? 0,
      'groq-llama70b': d.groqLlama70bExtractions ?? 0,
    },
    totalExtractions: d.totalExtractions ?? 0,
    totalFailed: d.totalFailed ?? 0,
  }
}
