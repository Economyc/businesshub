// Núcleo compartido del reporte de pagos pendientes por compañía: construye las
// secciones (facturas por proveedor + otras obligaciones) y el caption. Lo usan
// el cron notifyPendingPayments y el botón/comando on-demand del bot de Telegram.
import { db } from '../firestore.js';
import { fmtMoney } from './format-money.js';
export const PENDING_STATUSES = ['pending', 'overdue', 'partial'];
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
export function bogotaLabel(date) {
    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'America/Bogota',
    }).format(date);
}
/** Construye la sección de una compañía. Devuelve null si no tiene nada pendiente. */
export async function buildCompanySection(companyId, companyName) {
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
export function buildCaption(report) {
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
//# sourceMappingURL=pending-payments-core.js.map