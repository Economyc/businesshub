// Cron nocturno (23:00 Bogotá): manda a cada usuario vinculado a Telegram cuánto
// debe provisionar cada punto de propinas, impoconsumo y retefuente
// (autorretención 3.5%), del día y acumulado del mes.
//
// Cifras = tarjetas de Punto de Venta → Ventas (ver utils/provision-totals.ts):
//   - Hoy: se pide EN VIVO al POS, porque a las 11 PM el caché del día puede
//     estar viejo (el cliente solo lo refresca cuando alguien abre la página).
//   - Del 1 a ayer: companies/{id}/pos-sales-cache, que posReconcileNightly deja
//     al día a la 1 AM. Se filtra por id_local: el caché de Blue trae
//     comprobantes de la otra sede.
//
// Destinatarios: telegramLinks/{chatId}.uid → loadUserCompanies(uid); cada chat
// ve solo las companies con POS donde es miembro activo.
//
// Deploy SIEMPRE con gcloud (ver CLAUDE.md), región us-central1, secrets
// TELEGRAM_BOT_TOKEN + POS_TOKEN + POS_TOKEN_FILIPO.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './firestore.js';
import { telegramBotToken } from './telegram/index.js';
import { loadUserCompanies } from './telegram/auth.js';
import { formatCop } from './telegram/format.js';
import { sendMessage } from './utils/telegram-send.js';
import { fetchDominio, fetchAllPagesForLocal, delay, BATCH_DELAY_MS } from './pos-client.js';
import { buildCompanyLocalMap } from './pos-company-mapping.js';
import { TENANT_SECRETS, getTenantDomainId, getTenantToken, listTenantIds } from './pos-tenants.js';
import { SALES_COLLECTION, applyManualVoid, getTodayStrBogota } from './pos-cache.js';
import { addProvisions, calcProvisions, EMPTY_PROVISIONS, } from './utils/provision-totals.js';
async function loadCachedMonth(companyId, localIds, monthStart, today) {
    if (monthStart >= today)
        return EMPTY_PROVISIONS;
    const snap = await db
        .collection('companies')
        .doc(companyId)
        .collection(SALES_COLLECTION)
        .where('date', '>=', monthStart)
        .where('date', '<', today)
        .get();
    const localSet = new Set(localIds);
    const ventas = [];
    for (const doc of snap.docs) {
        for (const v of (doc.data().ventas ?? [])) {
            if (localSet.has(Number(v.id_local)))
                ventas.push(v);
        }
    }
    return calcProvisions(ventas);
}
// Recorre los tenants POS y calcula hoy + mes por company. Dentro de un tenant
// vamos en serie porque el POS rate-limitea por token.
async function computeAllPoints(today) {
    const monthStart = `${today.slice(0, 7)}-01`;
    const results = new Map();
    for (const tenantId of listTenantIds()) {
        try {
            const token = getTenantToken(tenantId);
            const domainId = getTenantDomainId(tenantId);
            const { locales } = await fetchDominio(token, domainId);
            const entries = await buildCompanyLocalMap(tenantId, locales);
            for (const entry of entries) {
                try {
                    const todayVentas = [];
                    let todayIncomplete = false;
                    for (const localId of entry.localIds) {
                        const res = await fetchAllPagesForLocal(token, domainId, localId, today, today);
                        if (res.rateLimited)
                            todayIncomplete = true;
                        for (const raw of res.ventas) {
                            if (Number(raw.id_local) === localId)
                                todayVentas.push(applyManualVoid(raw));
                        }
                        await delay(BATCH_DELAY_MS);
                    }
                    const todayTotals = calcProvisions(todayVentas);
                    const cached = await loadCachedMonth(entry.companyId, entry.localIds, monthStart, today);
                    results.set(entry.companyId, {
                        today: todayTotals,
                        month: addProvisions(cached, todayTotals),
                        todayIncomplete,
                        error: null,
                    });
                }
                catch (err) {
                    console.error(`[provisions] company=${entry.companyId} falló:`, err);
                    results.set(entry.companyId, {
                        today: EMPTY_PROVISIONS,
                        month: EMPTY_PROVISIONS,
                        todayIncomplete: false,
                        error: String(err),
                    });
                }
            }
        }
        catch (err) {
            console.error(`[provisions] tenant=${tenantId} falló:`, err);
        }
    }
    return results;
}
// "Manila · BSB": la ubicación primero y la marca de subtítulo.
function pointLabel(name, location) {
    const brand = /blue\s*smash/i.test(name) ? 'BSB' : name;
    return location ? `${location} · ${brand}` : brand;
}
function dateLabel(today) {
    return new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(`${today}T12:00:00-05:00`));
}
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function conceptLines(today, month) {
    return [
        `Propinas: <b>${formatCop(today.propinas)}</b> · mes ${formatCop(month.propinas)}`,
        `Impoconsumo: <b>${formatCop(today.impoconsumo)}</b> · mes ${formatCop(month.impoconsumo)}`,
        `Retefuente: <b>${formatCop(today.retefuente)}</b> · mes ${formatCop(month.retefuente)}`,
    ];
}
function buildMessage(today, points) {
    const lines = [`🧾 <b>Provisiones</b> — ${dateLabel(today)}`, '<i>hoy · acumulado del mes</i>'];
    let totalToday = EMPTY_PROVISIONS;
    let totalMonth = EMPTY_PROVISIONS;
    for (const { label, result } of points) {
        lines.push('', `<b>${escapeHtml(label)}</b>`);
        if (result.error) {
            lines.push('⚠️ sin datos (error POS)');
            continue;
        }
        lines.push(...conceptLines(result.today, result.month));
        if (result.todayIncomplete)
            lines.push('⚠️ datos de hoy incompletos (POS ocupado)');
        totalToday = addProvisions(totalToday, result.today);
        totalMonth = addProvisions(totalMonth, result.month);
    }
    if (points.length > 1) {
        lines.push('', '<b>Total</b>', ...conceptLines(totalToday, totalMonth));
    }
    return lines.join('\n');
}
export const notifyDailyProvisions = onSchedule({
    schedule: 'every day 23:00',
    timeZone: 'America/Bogota',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
    retryCount: 0,
    secrets: [telegramBotToken, ...TENANT_SECRETS],
}, async () => {
    // 1. uid -> [chatId] desde telegramLinks.
    const links = await db.collection('telegramLinks').get();
    if (links.empty) {
        console.log('[provisions] sin telegramLinks, nada que enviar');
        return;
    }
    const byUid = new Map();
    for (const doc of links.docs) {
        const uid = doc.data().uid;
        if (!uid)
            continue;
        const chats = byUid.get(uid);
        if (chats)
            chats.push(doc.id);
        else
            byUid.set(uid, [doc.id]);
    }
    // 2. Cifras de todos los puntos con POS (una sola pasada por el POS).
    const today = getTodayStrBogota();
    const results = await computeAllPoints(today);
    // 3. Un mensaje por chat con sus puntos.
    const token = telegramBotToken.value();
    let sent = 0;
    for (const [uid, chatIds] of byUid) {
        try {
            const companies = await loadUserCompanies(uid);
            const points = companies
                .filter((c) => results.has(c.id))
                .map((c) => ({ label: pointLabel(c.name, c.location), result: results.get(c.id) }))
                .sort((a, b) => a.label.localeCompare(b.label, 'es'));
            if (points.length === 0)
                continue;
            const text = buildMessage(today, points);
            for (const chatId of chatIds) {
                if (await sendMessage(token, chatId, text))
                    sent++;
            }
        }
        catch (err) {
            console.error(`[provisions] uid=${uid} falló:`, err);
        }
    }
    console.log(`[provisions] enviados=${sent} uids=${byUid.size} puntos=${results.size}`);
});
//# sourceMappingURL=notify-daily-provisions.js.map