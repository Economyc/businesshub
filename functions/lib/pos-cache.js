// Server-side port del schema de cache POS.
//
// FUENTE DE VERDAD: `src/modules/pos-sync/cache-service.ts`. Cualquier cambio
// al layout de `pos-sales-cache/*` o `pos-sales-cache-meta/*` debe reflejarse
// en ambos lados o el cliente y el cron se pisarán. Este archivo existe porque
// Cloud Functions usa admin SDK y el repo no tiene monorepo setup para
// compartir código con el frontend.
//
// Contrato preservado:
//   - collections: `pos-sales-cache`, `pos-sales-cache-meta`
//   - doc id ventas: `${date}_${localId}_p${page}`
//   - fields ventas: { date, localId, page, pages, ventas, syncedAt }
//   - meta doc path: `pos-sales-cache-meta/${YYYY-MM}`
//   - meta fields: { month, days: { "YYYY-MM-DD_localId": Timestamp } }
//   - MAX_VENTAS_PER_DOC = 150 (para no exceder 1 MiB por doc)
//   - PARTIAL_RESPONSE_THRESHOLD = 0.5 (no sobreescribir con respuesta parcial)
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firestore.js';
export const SALES_COLLECTION = 'pos-sales-cache';
export const META_COLLECTION = 'pos-sales-cache-meta';
export const MAX_VENTAS_PER_DOC = 150;
export const PARTIAL_RESPONSE_THRESHOLD = 0.5;
// Umbral mínimo de ventas cacheadas para activar la guarda anti-partial.
// Días con <10 ventas previas se sobrescriben libremente: el ruido de
// parciales en días de bajo volumen (domingos, cierres) impedía rellenar
// huecos en refetchs legítimas.
export const PARTIAL_GUARD_MIN_PREV = 10;
// Firestore permite hasta 500 operaciones por batch; dejamos margen para el
// batch.set del meta doc al final.
const MAX_WRITES_PER_BATCH = 450;
export function isLikelyPartialResponse(newCount, prevCount) {
    return prevCount >= PARTIAL_GUARD_MIN_PREV && newCount < prevCount * PARTIAL_RESPONSE_THRESHOLD;
}
export function enumerateDates(start, end) {
    const dates = [];
    const current = new Date(start + 'T12:00:00');
    const endDate = new Date(end + 'T12:00:00');
    while (current <= endDate) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}
export function getTodayStrBogota() {
    // Cloud Functions corre en UTC; forzamos TZ BOG usando Intl.
    // 'en-CA' formatea como 'YYYY-MM-DD'. POS (Perú) es UTC-5 igual que BOG.
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}
export function addDays(date, days) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
// Lee los conteos de ventas ya cacheadas por (date, local) en el rango para
// decidir si una nueva respuesta luce como parcial. No lee las ventas en sí.
export async function getPreviousCountsForRange(companyId, localIds, startDate, endDate) {
    const localSet = new Set(localIds.map(String));
    const counts = new Map();
    const snap = await db
        .collection('companies')
        .doc(companyId)
        .collection(SALES_COLLECTION)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();
    for (const doc of snap.docs) {
        const data = doc.data();
        if (!data.date || data.localId === undefined)
            continue;
        if (!localSet.has(String(data.localId)))
            continue;
        const key = `${data.date}_${data.localId}`;
        const len = Array.isArray(data.ventas) ? data.ventas.length : 0;
        counts.set(key, (counts.get(key) ?? 0) + len);
    }
    return counts;
}
// Escribe ventas al mismo schema que el cliente. `ventas` debe venir ya
// filtrado a los `localIds` relevantes para la company. `startDate`/`endDate`
// definen qué días cubre la escritura (aunque no haya ventas en ese día — el
// meta doc marca el día como sincronizado para que el cliente no lo considere
// faltante).
export async function saveVentasToCacheServer(companyId, ventas, localIds, startDate, endDate, previousCounts, options = {}) {
    const { stampEmpty = false } = options;
    const groups = new Map();
    for (const v of ventas) {
        const date = typeof v.fecha === 'string' ? v.fecha.slice(0, 10) : undefined;
        if (!date)
            continue;
        const key = `${date}_${v.id_local}`;
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(v);
    }
    const allDates = enumerateDates(startDate, endDate);
    const now = Timestamp.now();
    const metaUpdates = new Map();
    const pendingVentas = [];
    let skippedPartial = 0;
    let ventasWritten = 0;
    let emptyStamped = 0;
    const daysWrittenSet = new Set();
    for (const date of allDates) {
        const month = date.slice(0, 7);
        if (!metaUpdates.has(month))
            metaUpdates.set(month, {});
        const monthPayload = metaUpdates.get(month);
        for (const localId of localIds) {
            const key = `${date}_${localId}`;
            const group = groups.get(key);
            const newCount = group?.length ?? 0;
            const prevCount = previousCounts.get(key) ?? 0;
            if (isLikelyPartialResponse(newCount, prevCount)) {
                console.debug(`[PosReconcile] skip overwrite for ${companyId}/${key}: new=${newCount} < prev=${prevCount}`);
                skippedPartial++;
                continue;
            }
            // Día confirmadamente vacío: stampar meta sin crear doc de ventas para
            // que el cliente no lo siga clasificando como "needs fetch". Solo
            // cuando el caller garantiza que la respuesta del POS fue completa.
            if (newCount === 0 && prevCount === 0) {
                if (stampEmpty) {
                    monthPayload[key] = now;
                    emptyStamped++;
                }
                continue;
            }
            monthPayload[key] = now;
            daysWrittenSet.add(key);
            if (group && group.length > 0) {
                const pages = Math.ceil(group.length / MAX_VENTAS_PER_DOC);
                for (let p = 0; p < pages; p++) {
                    const chunk = group.slice(p * MAX_VENTAS_PER_DOC, (p + 1) * MAX_VENTAS_PER_DOC);
                    const docId = `${key}_p${p}`;
                    pendingVentas.push({
                        path: [companyId, SALES_COLLECTION, docId],
                        payload: {
                            date,
                            localId,
                            page: p,
                            pages,
                            ventas: chunk,
                            syncedAt: now,
                        },
                    });
                    ventasWritten += chunk.length;
                }
            }
        }
    }
    // Chunkear batches ≤450 writes para no exceder el límite de 500 de Firestore.
    for (let i = 0; i < pendingVentas.length; i += MAX_WRITES_PER_BATCH) {
        const slice = pendingVentas.slice(i, i + MAX_WRITES_PER_BATCH);
        const batch = db.batch();
        for (const w of slice) {
            const [cid, coll, docId] = w.path;
            batch.set(db.collection('companies').doc(cid).collection(coll).doc(docId), w.payload);
        }
        await batch.commit();
    }
    // Meta docs en batch separado (típicamente 1-2 docs).
    if (metaUpdates.size > 0) {
        const metaBatch = db.batch();
        for (const [month, days] of metaUpdates) {
            if (Object.keys(days).length === 0)
                continue;
            const ref = db
                .collection('companies')
                .doc(companyId)
                .collection(META_COLLECTION)
                .doc(month);
            metaBatch.set(ref, { month, days }, { merge: true });
        }
        await metaBatch.commit();
    }
    return {
        daysWritten: daysWrittenSet.size,
        ventasWritten,
        skippedPartial,
        emptyStamped,
    };
}
//# sourceMappingURL=pos-cache.js.map