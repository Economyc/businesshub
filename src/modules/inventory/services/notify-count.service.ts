import { httpsCallable } from 'firebase/functions'
import { getAppFunctions } from '@/core/firebase/config'

/** Una línea de diferencia ya calculada en cliente (ver domain/compute-variance). */
export interface CountDiffLine {
  name: string
  unit: string
  expected: number
  counted: number
  diff: number
  diffValue: number | null
}

/** Una línea del inventario completo (todas las activas, con o sin diferencia). */
export interface CountAllLine {
  name: string
  unit: string
  category: string
  expected: number
  counted: number
  diff: number
  diffValue: number | null
}

export interface NotifyCountDiffInput {
  companyId: string
  /** 'YYYY-MM-DD' del conteo. */
  countDate: string
  approvedBy: string
  companyName?: string
  currency?: string
  /** Solo las líneas con diferencia (faltante/sobrante). */
  lines: CountDiffLine[]
  /** Inventario completo (todas las activas). Habilita PDF + CSV adjuntos. */
  allLines?: CountAllLine[]
  totals: {
    shortageValue: number
    overageValue: number
    netValue: number
    itemsWithDiff: number
  }
}

export interface NotifyCountDiffResult {
  ok: boolean
  /** 'not-linked' = el usuario no tiene Telegram vinculado (estado normal). */
  reason?: 'not-linked'
  /** A cuántos chats se envió. */
  sent?: number
}

/**
 * Envía el reporte de diferencias del conteo al Telegram del usuario que aprueba.
 * El callable resuelve el chat por su uid (telegramLinks). No bloquea la aprobación:
 * si Telegram falla o no está vinculado, el conteo ya quedó final igual.
 */
export async function notifyCountDiff(input: NotifyCountDiffInput): Promise<NotifyCountDiffResult> {
  const fns = await getAppFunctions()
  const fn = httpsCallable<NotifyCountDiffInput, NotifyCountDiffResult>(fns, 'notifyCountDiff')
  const res = await fn(input)
  return res.data
}
