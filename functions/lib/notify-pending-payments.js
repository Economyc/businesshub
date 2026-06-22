// Cron diario (08:30 Bogotá, después de dailyOverdueCheck que a las 08:00 marca
// overdue): envía a cada usuario vinculado a Telegram un PDF consolidado con los
// pagos pendientes de TODAS sus compañías. Sin pedirlo, sin abrir la app.
//
// Destinatarios: se resuelven desde telegramLinks/{chatId}.uid (no hay auth en el
// cron). Por cada uid, sus compañías activas vía loadUserCompanies(). Si un uid no
// tiene nada pendiente, recibe un texto corto en vez de un PDF vacío.
//
// Datos: una sola query por compañía (status in [...], sin índice compuesto) y se
// separa en memoria facturas (documentKind=='invoice') vs otras obligaciones
// (type=='expense' && documentKind!='invoice'). Espeja getPendingInvoicesBySupplier
// (finance-tools) y getWeeklyObligations (obligations-tools).
//
// Deploy SIEMPRE con gcloud (ver CLAUDE.md), región us-central1, secret TELEGRAM_BOT_TOKEN.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './firestore.js';
import { telegramBotToken } from './telegram/index.js';
import { loadUserCompanies } from './telegram/auth.js';
import { sendDocument, sendMessage } from './utils/telegram-send.js';
import { fmtMoney } from './utils/format-money.js';
import { buildPendingPaymentsPdf, } from './utils/build-pending-payments-pdf.js';
const PENDING_STATUSES = ['pending', 'overdue', 'partial'];
/** Acepta Timestamp de Admin (toDate), serializado (_seconds) o Date. */
function tsToDate(val) {
    if (!val)
        return null;
    if (val instanceof Date)
        return val;
    if (typeof val === 'object' && val !== null) {
        const o = val;
        if (typeof o.toDate === 'function')
            return o.toDate();
        if (typeof o._seconds === 'number')
            return new Date(o._seconds * 1000);
        if (typeof o.seconds === 'number')
            return new Date(o.seconds * 1000);
    }
    return null;
}
function isoDate(d) {
    return d ? d.toISOString().split('T')[0] : null;
}
function bogotaLabel(date) {
    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'America/Bogota',
    }).format(date);
}
/** Construye la sección de una compañía. Devuelve null si no tiene nada pendiente. */
async function buildCompanySection(companyId, companyName) {
    const snap = await db
        .collection('companies')
        .doc(companyId)
        .collection('transactions')
        .where('status', 'in', PENDING_STATUSES)
        .get();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Bloque A — facturas por pagar agrupadas por proveedor.
    const groups = new Map();
    let invoiceTotal = 0;
    let invoiceCount = 0;
    // Bloque B — otras obligaciones (gasto pendiente que NO es factura).
    const obligations = [];
    let obligationTotal = 0;
    for (const doc of snap.docs) {
        const t = doc.data();
        const amount = Number(t.amount) || 0;
        if (t.documentKind === 'invoice') {
            const name = t.payeeRef?.name ?? 'Sin proveedor';
            const key = name.toLowerCase().trim();
            const entry = groups.get(key) ??
                { supplierName: name, count: 0, total: 0, oldestDate: null, overdueCount: 0, oldest: null };
            entry.count += 1;
            entry.total += amount;
            const d = tsToDate(t.date);
            if (d && (!entry.oldest || d < entry.oldest))
                entry.oldest = d;
            if (t.status === 'overdue' || (d && d < today))
                entry.overdueCount += 1;
            groups.set(key, entry);
            invoiceTotal += amount;
            invoiceCount += 1;
        }
        else if (t.type === 'expense' && (t.status === 'pending' || t.status === 'overdue')) {
            obligations.push({
                concept: String(t.concept ?? ''),
                dueDate: isoDate(tsToDate(t.dueDate) ?? tsToDate(t.date)),
                amount,
                status: String(t.status ?? 'pending'),
            });
            obligationTotal += amount;
        }
    }
    if (invoiceCount === 0 && obligations.length === 0)
        return null;
    const invoiceSuppliers = Array.from(groups.values())
        .map((g) => ({
        supplierName: g.supplierName,
        count: g.count,
        total: g.total,
        oldestDate: isoDate(g.oldest),
        overdueCount: g.overdueCount,
    }))
        .sort((a, b) => b.total - a.total);
    obligations.sort((a, b) => b.amount - a.amount);
    return {
        companyName,
        invoiceSuppliers,
        invoiceTotal,
        invoiceCount,
        obligations,
        obligationTotal,
        obligationCount: obligations.length,
        companyTotal: invoiceTotal + obligationTotal,
    };
}
function buildCaption(report) {
    const lines = [
        `💸 <b>Pagos pendientes</b> — ${report.dateLabel}`,
        `Total por pagar: <b>${fmtMoney(report.grandTotal)}</b>`,
        '',
        ...report.companies.map((c) => `• ${c.companyName}: ${fmtMoney(c.companyTotal)}`),
        '',
        'Detalle completo en el PDF adjunto.',
    ];
    return lines.join('\n');
}
export const notifyPendingPayments = onSchedule({
    schedule: 'every day 08:30',
    timeZone: 'America/Bogota',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
    retryCount: 0,
    secrets: [telegramBotToken],
}, async () => {
    // 1. uid -> [chatId] desde telegramLinks.
    const links = await db.collection('telegramLinks').get();
    if (links.empty) {
        console.log('[pending-payments] sin telegramLinks, nada que enviar');
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
    const token = telegramBotToken.value();
    const dateLabel = bogotaLabel(new Date());
    let sent = 0;
    for (const [uid, chatIds] of byUid) {
        try {
            const companies = await loadUserCompanies(uid);
            const sections = [];
            for (const c of companies) {
                const section = await buildCompanySection(c.id, c.name);
                if (section)
                    sections.push(section);
            }
            // Sin pendientes en ninguna compañía → texto corto, no PDF vacío.
            if (sections.length === 0) {
                for (const chatId of chatIds) {
                    await sendMessage(token, chatId, `✅ <b>Sin pagos pendientes hoy</b> — ${dateLabel}`);
                }
                continue;
            }
            sections.sort((a, b) => b.companyTotal - a.companyTotal);
            const report = {
                dateLabel,
                companies: sections,
                grandTotal: sections.reduce((s, c) => s + c.companyTotal, 0),
            };
            const pdf = await buildPendingPaymentsPdf(report);
            const safeDate = dateLabel.replace(/[^\d]/g, '') || 'hoy';
            const caption = buildCaption(report);
            for (const chatId of chatIds) {
                if (await sendDocument(token, chatId, pdf, `pendientes-${safeDate}.pdf`, 'application/pdf', caption)) {
                    sent += 1;
                }
            }
        }
        catch (err) {
            console.error(`[pending-payments] uid=${uid} falló:`, err);
        }
    }
    console.log(`[pending-payments] enviados=${sent} uids=${byUid.size}`);
});
//# sourceMappingURL=notify-pending-payments.js.map