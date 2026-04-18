// Reconciliación nocturna de ventas POS.
//
// Hasta abril 2026 el cliente reconciliaba los últimos 32 días en cada carga,
// golpeando el POS ~1 vez por request con rate-limit de 6s. UX lenta y
// llamadas redundantes entre usuarios/filtros.
//
// Este módulo mueve esa reconciliación a un cron que corre 01:00 America/Bogota
// (ambos POS-Perú y BOG son UTC-5, así que la ventana de datos coincide).
// El cliente mantiene ventana de 2 días como safety net si el cron falla.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from './firestore.js';
import { fetchDominio, fetchAllPagesForLocal } from './pos-client.js';
import { addDays, getTodayStrBogota, getPreviousCountsForRange, saveVentasToCacheServer, } from './pos-cache.js';
import { buildCompanyLocalMap } from './pos-company-mapping.js';
const posToken = defineSecret('POS_TOKEN');
export const DEFAULT_RECONCILE_DAYS = 32;
// Cooldown por company: evita double-clicks y abuso, pero sin bloquear al usuario
// por varios minutos si el primer intento falló o devolvió parcial.
const MANUAL_COOLDOWN_MS = 60 * 1000;
// Tamaño máximo de ventana contra el POS. Rangos más grandes disparan
// respuestas parciales / rate-limits internos del endpoint
// obtenerVentasPorIntegracion. 31 días es el mismo orden que funciona en el
// cron nocturno por default.
const POS_WINDOW_DAYS = 31;
function buildWindows(startDate, endDate, windowDays) {
    const windows = [];
    let cursor = startDate;
    while (cursor <= endDate) {
        const tentativeEnd = addDays(cursor, windowDays - 1);
        const end = tentativeEnd > endDate ? endDate : tentativeEnd;
        windows.push({ start: cursor, end });
        cursor = addDays(end, 1);
    }
    return windows;
}
async function runReconcile(opts) {
    const days = opts.days ?? DEFAULT_RECONCILE_DAYS;
    const today = getTodayStrBogota();
    const startDate = addDays(today, -days);
    const endDate = addDays(today, -1);
    const locales = opts.locales ?? (await fetchDominio(opts.token)).locales;
    const map = await buildCompanyLocalMap(locales);
    const filtered = opts.targetCompanyIds
        ? map.filter((m) => opts.targetCompanyIds.includes(m.companyId))
        : map;
    console.log(`[PosReconcile] start days=${days} range=${startDate}..${endDate} companies=${filtered.length}`);
    const t0 = Date.now();
    const perCompany = [];
    const windows = buildWindows(startDate, endDate, POS_WINDOW_DAYS);
    // Secuencial: el token POS es compartido y correr companies en paralelo
    // dispara rate-limits de 5s cruzados entre sí. Si crece a >50 companies
    // habría que sharding (schedules 01/02/03 BOG).
    for (const { companyId, localIds } of filtered) {
        const cStart = Date.now();
        const stats = {
            companyId,
            localIds,
            ventasFetched: 0,
            ventasWritten: 0,
            daysWritten: 0,
            skippedPartial: 0,
            emptyStamped: 0,
            rateLimited: false,
            durationMs: 0,
        };
        try {
            // El lookup de counts previos se hace una vez sobre todo el rango; los
            // writes parciales de ventanas anteriores no alteran los counts que
            // usamos para la guarda anti-partial, por diseño (queremos comparar
            // contra lo que había antes del reconcile, no contra lo que acabamos
            // de escribir).
            const prev = await getPreviousCountsForRange(companyId, localIds, startDate, endDate);
            for (const lid of localIds) {
                for (const window of windows) {
                    const wf1 = `${window.start} 00:00:00`;
                    const wf2 = `${window.end} 23:59:59`;
                    const r = await fetchAllPagesForLocal(opts.token, lid, wf1, wf2);
                    stats.ventasFetched += r.ventas.length;
                    // Persistimos tras cada ventana. Si el timeout de 3600s nos alcanza
                    // en medio, el trabajo anterior queda cacheado y el próximo run
                    // continúa desde donde quedó. stampEmpty solo cuando la ventana
                    // terminó sin rate-limit: ceros "truncados" no son confiables.
                    const save = await saveVentasToCacheServer(companyId, r.ventas, [lid], window.start, window.end, prev, { stampEmpty: !r.rateLimited });
                    stats.ventasWritten += save.ventasWritten;
                    stats.daysWritten += save.daysWritten;
                    stats.skippedPartial += save.skippedPartial;
                    stats.emptyStamped += save.emptyStamped;
                    if (r.rateLimited) {
                        // Rate-limit es por local/ventana; NO bloquea los demás locales ni
                        // companies. Anteriormente un `break` externo abortaba toda la
                        // corrida, perdiendo datos de locales siguientes que aún podrían
                        // responder. Ahora seguimos con el próximo local.
                        stats.rateLimited = true;
                        console.warn(`[PosReconcile] rate-limited company=${companyId} local=${lid} ` +
                            `window=${window.start}..${window.end} — saltando al próximo local`);
                        break;
                    }
                }
            }
            console.log(`[PosReconcile] company=${companyId} locales=[${localIds.join(',')}] ` +
                `windows=${windows.length} fetched=${stats.ventasFetched} ` +
                `written=${stats.ventasWritten} days=${stats.daysWritten} ` +
                `emptyStamped=${stats.emptyStamped} skipped=${stats.skippedPartial} ` +
                `rateLimited=${stats.rateLimited}`);
        }
        catch (err) {
            stats.error = err instanceof Error ? err.message : String(err);
            console.error(`[PosReconcile] error company=${companyId}: ${stats.error}`);
        }
        stats.durationMs = Date.now() - cStart;
        perCompany.push(stats);
    }
    const totalDurationMs = Date.now() - t0;
    const ventasWrittenTotal = perCompany.reduce((s, c) => s + c.ventasWritten, 0);
    console.log(`[PosReconcile] complete companies=${perCompany.length} ventas=${ventasWrittenTotal} duration=${totalDurationMs}ms`);
    // Escribir resumen para observabilidad sin depender de logs.
    try {
        await db
            .collection('reports')
            .doc('pos-reconcile')
            .collection('runs')
            .doc(today)
            .set({
            date: today,
            startDate,
            endDate,
            perCompany,
            ventasWritten: ventasWrittenTotal,
            totalDurationMs,
            finishedAt: Timestamp.now(),
        }, { merge: true });
    }
    catch (err) {
        console.warn(`[PosReconcile] failed to persist report: ${err}`);
    }
    return {
        startDate,
        endDate,
        companiesProcessed: perCompany.length,
        ventasWritten: ventasWrittenTotal,
        totalDurationMs,
        perCompany,
    };
}
export const posReconcileNightly = onSchedule({
    schedule: 'every day 01:00',
    timeZone: 'America/Bogota',
    timeoutSeconds: 3600,
    memory: '1GiB',
    secrets: [posToken],
    // 1 reintento: si el primer intento falla por timeout transitorio o
    // rate-limit del POS a la hora del cron, el scheduler lo vuelve a
    // disparar con backoff. Mejor que perder un día entero de datos.
    retryCount: 1,
}, async () => {
    await runReconcile({ token: posToken.value() });
});
// Callable para el botón "Forzar sincronización" y el auto-trigger del Home
// cuando el usuario carga rangos > 32 días. Auth obligatoria; cooldown corto por
// company para evitar double-fire. No verifica membresía: asume que el check de
// permisos del frontend ya aplicó. Timeout al máximo (60 min) porque reconciliar
// 365 días para una company con varios locales puede acercarse fácil a 30-40 min
// — el rate-limit reactivo del POS (fetchAllPagesForLocal en pos-client.ts) ya
// espacia los requests cuando detecta "solicitud en ejecución".
export const posReconcileOnDemand = onCall({
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
}, async (req) => {
    if (!req.auth) {
        throw new HttpsError('unauthenticated', 'Autenticación requerida');
    }
    const { companyId, days } = req.data ?? {};
    if (!companyId || typeof companyId !== 'string') {
        throw new HttpsError('invalid-argument', 'companyId es requerido');
    }
    const metaRef = db
        .collection('companies')
        .doc(companyId)
        .collection('settings')
        .doc('pos-reconcile-meta');
    const metaSnap = await metaRef.get();
    const lastRun = metaSnap.exists ? metaSnap.data()?.lastRun : undefined;
    if (lastRun) {
        const ageMs = Date.now() - lastRun.toMillis();
        if (ageMs < MANUAL_COOLDOWN_MS) {
            const waitS = Math.ceil((MANUAL_COOLDOWN_MS - ageMs) / 1000);
            throw new HttpsError('resource-exhausted', `Ya se reconcilió hace poco. Espera ${waitS}s antes de volver a forzar.`);
        }
    }
    // inProgress + startedAt: el cliente lo lee para suprimir fetches
    // paralelos mientras el reconcile corre (evita competir por el token POS).
    // startedAt permite al cliente ignorar reconciles "stuck" (>1h) como
    // señal muerta en caso de que un crash omita el finally.
    await metaRef.set({
        lastRun: FieldValue.serverTimestamp(),
        startedAt: FieldValue.serverTimestamp(),
        inProgress: true,
    }, { merge: true });
    try {
        return await runReconcile({
            token: posToken.value(),
            targetCompanyIds: [companyId],
            days: typeof days === 'number' && days > 0 && days <= 365 ? days : DEFAULT_RECONCILE_DAYS,
        });
    }
    finally {
        await metaRef.set({ inProgress: false, finishedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
});
//# sourceMappingURL=pos-reconcile.js.map