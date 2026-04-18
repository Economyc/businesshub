// Reconciliación nocturna de ventas POS.
//
// Hasta abril 2026 el cliente reconciliaba los últimos 32 días en cada carga,
// golpeando el POS ~1 vez por request con rate-limit de 6s. UX lenta y
// llamadas redundantes entre usuarios/filtros.
//
// Este módulo mueve esa reconciliación a un cron que corre 01:00 America/Bogota
// (ambos POS-Perú y BOG son UTC-5, así que la ventana de datos coincide).
// El cliente mantiene ventana de 2 días como safety net si el cron falla.

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { db } from './firestore.js'
import { fetchDominio, fetchAllPagesForLocal, type PosLocalRaw } from './pos-client.js'
import {
  addDays,
  getTodayStrBogota,
  getPreviousCountsForRange,
  saveVentasToCacheServer,
  type PosVentaLike,
} from './pos-cache.js'
import { buildCompanyLocalMap } from './pos-company-mapping.js'

const posToken = defineSecret('POS_TOKEN')

export const DEFAULT_RECONCILE_DAYS = 32
// Cooldown por company: evita double-clicks y abuso, pero sin bloquear al usuario
// por varios minutos si el primer intento falló o devolvió parcial.
const MANUAL_COOLDOWN_MS = 60 * 1000

export interface ReconcileStats {
  companyId: string
  localIds: number[]
  ventasFetched: number
  ventasWritten: number
  daysWritten: number
  skippedPartial: number
  rateLimited: boolean
  durationMs: number
  error?: string
}

export interface ReconcileResult {
  startDate: string
  endDate: string
  companiesProcessed: number
  ventasWritten: number
  totalDurationMs: number
  perCompany: ReconcileStats[]
}

interface RunReconcileOptions {
  token: string
  targetCompanyIds?: string[]
  days?: number
  locales?: PosLocalRaw[]
}

async function runReconcile(opts: RunReconcileOptions): Promise<ReconcileResult> {
  const days = opts.days ?? DEFAULT_RECONCILE_DAYS
  const today = getTodayStrBogota()
  const startDate = addDays(today, -days)
  const endDate = addDays(today, -1)
  const f1 = `${startDate} 00:00:00`
  const f2 = `${endDate} 23:59:59`

  const locales = opts.locales ?? (await fetchDominio(opts.token)).locales
  const map = await buildCompanyLocalMap(locales)

  const filtered = opts.targetCompanyIds
    ? map.filter((m) => opts.targetCompanyIds!.includes(m.companyId))
    : map

  console.log(
    `[PosReconcile] start days=${days} range=${startDate}..${endDate} companies=${filtered.length}`,
  )

  const t0 = Date.now()
  const perCompany: ReconcileStats[] = []

  // Secuencial: el token POS es compartido y correr companies en paralelo
  // dispara rate-limits de 5s cruzados entre sí. Si crece a >50 companies
  // habría que sharding (schedules 01/02/03 BOG).
  for (const { companyId, localIds } of filtered) {
    const cStart = Date.now()
    const stats: ReconcileStats = {
      companyId,
      localIds,
      ventasFetched: 0,
      ventasWritten: 0,
      daysWritten: 0,
      skippedPartial: 0,
      rateLimited: false,
      durationMs: 0,
    }

    try {
      const prev = await getPreviousCountsForRange(companyId, localIds, startDate, endDate)
      const allVentas: PosVentaLike[] = []
      for (const lid of localIds) {
        const r = await fetchAllPagesForLocal(opts.token, lid, f1, f2)
        allVentas.push(...(r.ventas as PosVentaLike[]))
        stats.ventasFetched += r.ventas.length
        if (r.rateLimited) {
          stats.rateLimited = true
          break
        }
      }

      const save = await saveVentasToCacheServer(
        companyId,
        allVentas,
        localIds,
        startDate,
        endDate,
        prev,
      )
      stats.ventasWritten = save.ventasWritten
      stats.daysWritten = save.daysWritten
      stats.skippedPartial = save.skippedPartial

      console.log(
        `[PosReconcile] company=${companyId} locales=[${localIds.join(',')}] ` +
          `fetched=${stats.ventasFetched} written=${stats.ventasWritten} ` +
          `days=${stats.daysWritten} skipped=${stats.skippedPartial} ` +
          `rateLimited=${stats.rateLimited}`,
      )
    } catch (err) {
      stats.error = err instanceof Error ? err.message : String(err)
      console.error(`[PosReconcile] error company=${companyId}: ${stats.error}`)
    }

    stats.durationMs = Date.now() - cStart
    perCompany.push(stats)
  }

  const totalDurationMs = Date.now() - t0
  const ventasWrittenTotal = perCompany.reduce((s, c) => s + c.ventasWritten, 0)

  console.log(
    `[PosReconcile] complete companies=${perCompany.length} ventas=${ventasWrittenTotal} duration=${totalDurationMs}ms`,
  )

  // Escribir resumen para observabilidad sin depender de logs.
  try {
    await db
      .collection('reports')
      .doc('pos-reconcile')
      .collection('runs')
      .doc(today)
      .set(
        {
          date: today,
          startDate,
          endDate,
          perCompany,
          ventasWritten: ventasWrittenTotal,
          totalDurationMs,
          finishedAt: Timestamp.now(),
        },
        { merge: true },
      )
  } catch (err) {
    console.warn(`[PosReconcile] failed to persist report: ${err}`)
  }

  return {
    startDate,
    endDate,
    companiesProcessed: perCompany.length,
    ventasWritten: ventasWrittenTotal,
    totalDurationMs,
    perCompany,
  }
}

export const posReconcileNightly = onSchedule(
  {
    schedule: 'every day 01:00',
    timeZone: 'America/Bogota',
    timeoutSeconds: 3600,
    memory: '1GiB',
    secrets: [posToken],
    retryCount: 0,
  },
  async () => {
    await runReconcile({ token: posToken.value() })
  },
)

interface OnDemandData {
  companyId?: string
  days?: number
}

// Callable para el botón "Forzar sincronización" y el auto-trigger del Home
// cuando el usuario carga rangos > 32 días. Auth obligatoria; cooldown corto por
// company para evitar double-fire. No verifica membresía: asume que el check de
// permisos del frontend ya aplicó. Timeout al máximo (60 min) porque reconciliar
// 365 días para una company con varios locales puede acercarse fácil a 30-40 min
// — el rate-limit reactivo del POS (fetchAllPagesForLocal en pos-client.ts) ya
// espacia los requests cuando detecta "solicitud en ejecución".
export const posReconcileOnDemand = onCall<OnDemandData>(
  {
    timeoutSeconds: 3600,
    memory: '1GiB',
    secrets: [posToken],
    cors: [
      'https://businesshub.myvnc.com',
      'http://134.65.233.213',
      'http://localhost:5173',
      /empresas-bf\.web\.app$/,
      /empresas-bf\.firebaseapp\.com$/,
    ],
  },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Autenticación requerida')
    }
    const { companyId, days } = req.data ?? {}
    if (!companyId || typeof companyId !== 'string') {
      throw new HttpsError('invalid-argument', 'companyId es requerido')
    }

    const metaRef = db
      .collection('companies')
      .doc(companyId)
      .collection('settings')
      .doc('pos-reconcile-meta')

    const metaSnap = await metaRef.get()
    const lastRun = metaSnap.exists ? (metaSnap.data()?.lastRun as Timestamp | undefined) : undefined
    if (lastRun) {
      const ageMs = Date.now() - lastRun.toMillis()
      if (ageMs < MANUAL_COOLDOWN_MS) {
        const waitS = Math.ceil((MANUAL_COOLDOWN_MS - ageMs) / 1000)
        throw new HttpsError(
          'resource-exhausted',
          `Ya se reconcilió hace poco. Espera ${waitS}s antes de volver a forzar.`,
        )
      }
    }

    await metaRef.set({ lastRun: FieldValue.serverTimestamp() }, { merge: true })

    return runReconcile({
      token: posToken.value(),
      targetCompanyIds: [companyId],
      days: typeof days === 'number' && days > 0 && days <= 365 ? days : DEFAULT_RECONCILE_DAYS,
    })
  },
)
