// Reconstrucción completa de un mes en el cache POS.
//
// Motivación: el reconcile nocturno usa ventanas de 31 días contra
// `obtenerVentasPorIntegracion`; en meses de alto volumen el POS devuelve
// respuestas parciales o hace timeout y el cache queda incompleto (enero y
// febrero 2026 así quedaron). La guarda `isLikelyPartialResponse` protege
// el cache sano pero no rescata los meses ya dañados.
//
// Este callable purga el mes completo y lo redescarga con ventanas de 15
// días, más pequeñas que el umbral en el que el POS empieza a fallar. Sólo
// para admins de la company (el frontend filtra; acá validamos auth).
//
// Flag `inProgress` se escribe igual que `posReconcileOnDemand` para que
// el cliente suprima fetches paralelos durante la operación.
//
// Multi-tenant: el token y domainId se resuelven a partir del posTenantId
// de la company. Ver pos-tenants.ts.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from './firestore.js';
import { fetchDominio, fetchAllPagesForLocal } from './pos-client.js';
import { addDays, deleteMonthFromCache, saveVentasToCacheServer, } from './pos-cache.js';
import { buildCompanyLocalMap } from './pos-company-mapping.js';
import { TENANT_SECRETS, getTenantDomainId, getTenantToken, resolveCompanyTenant, } from './pos-tenants.js';
// Ventana pequeña para evitar timeouts del POS en meses de alto volumen.
// Lo probamos manualmente: enero 2026 (31 días) fallaba con `fetch failed`;
// partido en dos quincenas respondía limpio.
const REBUILD_WINDOW_DAYS = 15;
const MANUAL_COOLDOWN_MS = 60 * 1000;
function lastDayOfMonth(month) {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${month}-${String(last).padStart(2, '0')}`;
}
function isValidMonth(month) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}
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
export const posRebuildMonth = onCall({
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
}, async (req) => {
    if (!req.auth) {
        throw new HttpsError('unauthenticated', 'Autenticación requerida');
    }
    const { companyId, month } = req.data ?? {};
    if (!companyId || typeof companyId !== 'string') {
        throw new HttpsError('invalid-argument', 'companyId es requerido');
    }
    if (!month || typeof month !== 'string' || !isValidMonth(month)) {
        throw new HttpsError('invalid-argument', "month debe tener formato 'YYYY-MM'");
    }
    let tenantId;
    try {
        tenantId = await resolveCompanyTenant(companyId);
    }
    catch (err) {
        throw new HttpsError('failed-precondition', err instanceof Error ? err.message : String(err));
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
            throw new HttpsError('resource-exhausted', `Hay un reconcile reciente. Espera ${waitS}s antes de reconstruir.`);
        }
    }
    await metaRef.set({
        lastRun: FieldValue.serverTimestamp(),
        startedAt: FieldValue.serverTimestamp(),
        inProgress: true,
    }, { merge: true });
    const t0 = Date.now();
    const token = getTenantToken(tenantId);
    const domainId = getTenantDomainId(tenantId);
    const result = {
        month,
        tenantId,
        companyId,
        localIds: [],
        salesDocsDeleted: 0,
        ventasFetched: 0,
        ventasWritten: 0,
        daysWritten: 0,
        windowsProcessed: 0,
        rateLimited: false,
        durationMs: 0,
    };
    try {
        const { locales } = await fetchDominio(token, domainId);
        const map = await buildCompanyLocalMap(tenantId, locales);
        const entry = map.find((m) => m.companyId === companyId);
        if (!entry) {
            throw new HttpsError('failed-precondition', `No se encontraron locales POS mapeados para la company ${companyId} (tenant ${tenantId})`);
        }
        result.localIds = entry.localIds;
        // Purgar el mes completo antes de redescargar. Con cache vacío, los
        // counts previos son cero y la guarda anti-partial no bloquea escrituras.
        const del = await deleteMonthFromCache(companyId, month);
        result.salesDocsDeleted = del.salesDocsDeleted;
        const startDate = `${month}-01`;
        const endDate = lastDayOfMonth(month);
        const windows = buildWindows(startDate, endDate, REBUILD_WINDOW_DAYS);
        // `prev` vacío: acabamos de purgar, no hay cache anterior contra el
        // que comparar. La guarda anti-partial queda efectivamente desactivada
        // (prevCount = 0 nunca activa el umbral), que es justo lo que queremos
        // durante un rebuild explícito.
        const emptyPrev = new Map();
        for (const lid of entry.localIds) {
            for (const window of windows) {
                const wf1 = `${window.start} 00:00:00`;
                const wf2 = `${window.end} 23:59:59`;
                const r = await fetchAllPagesForLocal(token, domainId, lid, wf1, wf2);
                result.ventasFetched += r.ventas.length;
                result.windowsProcessed++;
                const save = await saveVentasToCacheServer(companyId, r.ventas, [lid], window.start, window.end, emptyPrev, { stampEmpty: !r.rateLimited });
                result.ventasWritten += save.ventasWritten;
                result.daysWritten += save.daysWritten;
                if (r.rateLimited) {
                    result.rateLimited = true;
                    console.warn(`[PosRebuildMonth] rate-limited tenant=${tenantId} company=${companyId} ` +
                        `local=${lid} window=${window.start}..${window.end} — saltando al próximo local`);
                    break;
                }
            }
        }
        console.log(`[PosRebuildMonth] done tenant=${tenantId} company=${companyId} month=${month} ` +
            `locales=[${entry.localIds.join(',')}] deleted=${result.salesDocsDeleted} ` +
            `fetched=${result.ventasFetched} written=${result.ventasWritten} ` +
            `days=${result.daysWritten} rateLimited=${result.rateLimited}`);
        // Observabilidad: registrar el run en reports/ para debugging posterior.
        try {
            await db
                .collection('reports')
                .doc('pos-reconcile')
                .collection('rebuilds')
                .doc(`${companyId}_${month}`)
                .set({
                ...result,
                finishedAt: Timestamp.now(),
            }, { merge: true });
        }
        catch (err) {
            console.warn(`[PosRebuildMonth] failed to persist report: ${err}`);
        }
    }
    catch (err) {
        result.error = err instanceof Error ? err.message : String(err);
        console.error(`[PosRebuildMonth] error tenant=${tenantId} company=${companyId} month=${month}: ${result.error}`);
        if (err instanceof HttpsError) {
            await metaRef.set({ inProgress: false, finishedAt: FieldValue.serverTimestamp() }, { merge: true });
            throw err;
        }
    }
    finally {
        await metaRef.set({ inProgress: false, finishedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    result.durationMs = Date.now() - t0;
    return result;
});
//# sourceMappingURL=pos-rebuild-month.js.map