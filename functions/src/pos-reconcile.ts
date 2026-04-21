// Reconciliación nocturna de ventas POS.
//
// Hasta abril 2026 el cliente reconciliaba los últimos 32 días en cada carga,
// golpeando el POS ~1 vez por request con rate-limit de 6s. UX lenta y
// llamadas redundantes entre usuarios/filtros.
//
// Este módulo mueve esa reconciliación a un cron que corre 01:00 America/Bogota
// (ambos POS-Perú y BOG son UTC-5, así que la ventana de datos coincide).
// El cliente mantiene ventana de 2 días como safety net si el cron falla.
//
// Alcance del cron (desde 2026-04): cubre **solo el mes actual**, desde el día 1
// hasta ayer. Los meses pasados son datos cerrados para un restaurante y no
// vale la pena re-pedirlos cada noche. Si un mes anterior quedó con huecos
// (días con ceros legítimos o respuestas parciales que nunca stamparon), se
// completa bajo demanda desde la pestaña Caché con el botón "Reconstruir"
// (ver `src/modules/pos-sync/components/cache-status-tab.tsx`).
//
// Multi-tenant (2026-04): el cron itera todos los tenants configurados en
// pos-tenants.ts. Cada tenant tiene su propio token y domainId; dentro de
// un tenant las companies se procesan secuencialmente porque comparten
// token y el POS rate-limitea. Entre tenants también vamos secuencial para
// mantener logs legibles — los dominios son independientes en el servidor
// del POS así que podríamos paralelizar en el futuro si hace falta.

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
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
import {
  TENANT_SECRETS,
  getTenantDomainId,
  getTenantToken,
  listTenantIds,
  resolveCompanyTenant,
  type TenantId,
} from './pos-tenants.js'

// Default para `posReconcileOnDemand` cuando el caller no especifica `days`.
// El cron nocturno ya NO lo usa (cubre mes actual dinámicamente, ver runReconcile).
export const DEFAULT_RECONCILE_DAYS = 32

function firstDayOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`
}
// Cooldown por company: evita double-clicks y abuso, pero sin bloquear al usuario
// por varios minutos si el primer intento falló o devolvió parcial.
const MANUAL_COOLDOWN_MS = 60 * 1000
// Tamaño máximo de ventana contra el POS. Rangos más grandes disparan
// respuestas parciales / rate-limits internos del endpoint
// obtenerVentasPorIntegracion en meses de alto volumen (detectado en abril
// 2026: enero/febrero quedaron cacheados incompletos por correr 31 días
// en un único request). 15 días sí responde limpio incluso en meses con
// ~2k ventas. Trade-off: ~2-3 llamadas al POS por local por reconcile
// (antes 1), pero cada ventana es independiente: si una falla las demás
// ya quedaron persistidas y el próximo run continúa desde donde quedó.
const POS_WINDOW_DAYS = 15

export interface ReconcileStats {
  tenantId: TenantId
  companyId: string
  localIds: number[]
  ventasFetched: number
  ventasWritten: number
  daysWritten: number
  skippedPartial: number
  emptyStamped: number
  rateLimited: boolean
  durationMs: number
  error?: string
}

interface DateWindow {
  start: string
  end: string
}

function buildWindows(startDate: string, endDate: string, windowDays: number): DateWindow[] {
  const windows: DateWindow[] = []
  let cursor = startDate
  while (cursor <= endDate) {
    const tentativeEnd = addDays(cursor, windowDays - 1)
    const end = tentativeEnd > endDate ? endDate : tentativeEnd
    windows.push({ start: cursor, end })
    cursor = addDays(end, 1)
  }
  return windows
}

export interface ReconcileResult {
  startDate: string
  endDate: string
  companiesProcessed: number
  ventasWritten: number
  totalDurationMs: number
  perCompany: ReconcileStats[]
}

interface ReconcileCompanyOptions {
  tenantId: TenantId
  token: string
  domainId: string
  companyId: string
  localIds: number[]
  startDate: string
  endDate: string
  windows: DateWindow[]
}

async function reconcileCompany(opts: ReconcileCompanyOptions): Promise<ReconcileStats> {
  const cStart = Date.now()
  const stats: ReconcileStats = {
    tenantId: opts.tenantId,
    companyId: opts.companyId,
    localIds: opts.localIds,
    ventasFetched: 0,
    ventasWritten: 0,
    daysWritten: 0,
    skippedPartial: 0,
    emptyStamped: 0,
    rateLimited: false,
    durationMs: 0,
  }

  try {
    // El lookup de counts previos se hace una vez sobre todo el rango; los
    // writes parciales de ventanas anteriores no alteran los counts que
    // usamos para la guarda anti-partial, por diseño (queremos comparar
    // contra lo que había antes del reconcile, no contra lo que acabamos
    // de escribir).
    const prev = await getPreviousCountsForRange(
      opts.companyId,
      opts.localIds,
      opts.startDate,
      opts.endDate,
    )

    for (const lid of opts.localIds) {
      for (const window of opts.windows) {
        const wf1 = `${window.start} 00:00:00`
        const wf2 = `${window.end} 23:59:59`
        const r = await fetchAllPagesForLocal(opts.token, opts.domainId, lid, wf1, wf2)
        stats.ventasFetched += r.ventas.length

        // Persistimos tras cada ventana. Si el timeout de 3600s nos alcanza
        // en medio, el trabajo anterior queda cacheado y el próximo run
        // continúa desde donde quedó. stampEmpty solo cuando la ventana
        // terminó sin rate-limit: ceros "truncados" no son confiables.
        const save = await saveVentasToCacheServer(
          opts.companyId,
          r.ventas as PosVentaLike[],
          [lid],
          window.start,
          window.end,
          prev,
          { stampEmpty: !r.rateLimited },
        )
        stats.ventasWritten += save.ventasWritten
        stats.daysWritten += save.daysWritten
        stats.skippedPartial += save.skippedPartial
        stats.emptyStamped += save.emptyStamped

        if (r.rateLimited) {
          // Rate-limit es por local/ventana; NO bloquea los demás locales ni
          // companies. Anteriormente un `break` externo abortaba toda la
          // corrida, perdiendo datos de locales siguientes que aún podrían
          // responder. Ahora seguimos con el próximo local.
          stats.rateLimited = true
          console.warn(
            `[PosReconcile] rate-limited tenant=${opts.tenantId} company=${opts.companyId} ` +
              `local=${lid} window=${window.start}..${window.end} — saltando al próximo local`,
          )
          break
        }
      }
    }

    console.log(
      `[PosReconcile] tenant=${opts.tenantId} company=${opts.companyId} ` +
        `locales=[${opts.localIds.join(',')}] windows=${opts.windows.length} ` +
        `fetched=${stats.ventasFetched} written=${stats.ventasWritten} ` +
        `days=${stats.daysWritten} emptyStamped=${stats.emptyStamped} ` +
        `skipped=${stats.skippedPartial} rateLimited=${stats.rateLimited}`,
    )
  } catch (err) {
    stats.error = err instanceof Error ? err.message : String(err)
    console.error(
      `[PosReconcile] error tenant=${opts.tenantId} company=${opts.companyId}: ${stats.error}`,
    )
  }

  stats.durationMs = Date.now() - cStart
  return stats
}

interface RunReconcileOptions {
  // Si se pasa, solo procesa ese tenant (onDemand). Si no, itera todos (cron).
  tenantId?: TenantId
  targetCompanyIds?: string[]
  days?: number
  // Si se pasa junto con tenantId, evita refetchear el dominio desde el POS.
  locales?: PosLocalRaw[]
}

async function runReconcile(opts: RunReconcileOptions): Promise<ReconcileResult> {
  const today = getTodayStrBogota()
  const endDate = addDays(today, -1)
  // Cron (opts.days no seteado): cubrir solo el mes actual, desde el día 1.
  // On-demand (opts.days explícito): rango clásico de N días hacia atrás.
  const startDate =
    opts.days !== undefined ? addDays(today, -opts.days) : firstDayOfMonth(today)

  // Día 1 del mes a las 01:00 BOG → startDate=YYYY-MM-01, endDate=YYYY-(MM-1)-xx.
  // No hay nada que reconciliar del mes actual todavía. Saltamos el run.
  if (startDate > endDate) {
    console.log(
      `[PosReconcile] skip: día 1 del mes (start=${startDate} > end=${endDate}), nada que reconciliar`,
    )
    return {
      startDate,
      endDate,
      companiesProcessed: 0,
      ventasWritten: 0,
      totalDurationMs: 0,
      perCompany: [],
    }
  }

  const tenantsToRun: TenantId[] = opts.tenantId ? [opts.tenantId] : listTenantIds()
  const windows = buildWindows(startDate, endDate, POS_WINDOW_DAYS)

  console.log(
    `[PosReconcile] start mode=${opts.days !== undefined ? `days=${opts.days}` : 'currentMonth'} ` +
      `range=${startDate}..${endDate} tenants=[${tenantsToRun.join(',')}]`,
  )

  const t0 = Date.now()
  const perCompany: ReconcileStats[] = []

  for (const tenantId of tenantsToRun) {
    const token = getTenantToken(tenantId)
    const domainId = getTenantDomainId(tenantId)

    let locales: PosLocalRaw[]
    try {
      locales = opts.locales ?? (await fetchDominio(token, domainId)).locales
    } catch (err) {
      console.error(
        `[PosReconcile] tenant=${tenantId} fetchDominio falló: ` +
          (err instanceof Error ? err.message : String(err)),
      )
      continue
    }

    const map = await buildCompanyLocalMap(tenantId, locales)
    const filtered = opts.targetCompanyIds
      ? map.filter((m) => opts.targetCompanyIds!.includes(m.companyId))
      : map

    console.log(
      `[PosReconcile] tenant=${tenantId} locales=${locales.length} companies=${filtered.length}`,
    )

    // Secuencial dentro del tenant: comparten token y el POS rate-limitea.
    for (const { companyId, localIds } of filtered) {
      const stats = await reconcileCompany({
        tenantId,
        token,
        domainId,
        companyId,
        localIds,
        startDate,
        endDate,
        windows,
      })
      perCompany.push(stats)
    }
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
    secrets: TENANT_SECRETS,
    // 1 reintento: si el primer intento falla por timeout transitorio o
    // rate-limit del POS a la hora del cron, el scheduler lo vuelve a
    // disparar con backoff. Mejor que perder un día entero de datos.
    retryCount: 1,
  },
  async () => {
    await runReconcile({})
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
    secrets: TENANT_SECRETS,
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

    let tenantId: TenantId
    try {
      tenantId = await resolveCompanyTenant(companyId)
    } catch (err) {
      throw new HttpsError(
        'failed-precondition',
        err instanceof Error ? err.message : String(err),
      )
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

    // inProgress + startedAt: el cliente lo lee para suprimir fetches
    // paralelos mientras el reconcile corre (evita competir por el token POS).
    // startedAt permite al cliente ignorar reconciles "stuck" (>1h) como
    // señal muerta en caso de que un crash omita el finally.
    await metaRef.set(
      {
        lastRun: FieldValue.serverTimestamp(),
        startedAt: FieldValue.serverTimestamp(),
        inProgress: true,
      },
      { merge: true },
    )

    try {
      return await runReconcile({
        tenantId,
        targetCompanyIds: [companyId],
        days: typeof days === 'number' && days > 0 && days <= 365 ? days : DEFAULT_RECONCILE_DAYS,
      })
    } finally {
      await metaRef.set(
        { inProgress: false, finishedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
    }
  },
)
