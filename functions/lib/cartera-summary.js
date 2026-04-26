import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firestore.js';
// Resumen denormalizado de cartera (cuentas por cobrar/pagar) en
// `companies/{id}/summary/cartera`. El Home lo lee como 1 doc en vez de
// descargar transactions+purchases+payments completas. Pantalla de Cartera
// (que necesita lista detallada) sigue leyendo las colecciones directamente.
const TOP_OVERDUE_LIMIT = 20;
function tsToDate(ts) {
    if (!ts)
        return null;
    if (typeof ts.toDate === 'function')
        return ts.toDate();
    if (typeof ts._seconds === 'number') {
        return new Date(ts._seconds * 1000);
    }
    return null;
}
function daysBetween(from, to) {
    return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
export async function recomputeCarteraSummary(companyId) {
    const companyRef = db.collection('companies').doc(companyId);
    const [txSnap, purSnap, paySnap] = await Promise.all([
        companyRef.collection('transactions').get(),
        companyRef.collection('purchases').get(),
        companyRef.collection('payments').get(),
    ]);
    const transactions = txSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const purchases = purSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const payments = paySnap.docs.map((d) => d.data());
    // Agrupar pagos por target
    const paymentsByTarget = new Map();
    for (const p of payments) {
        const key = `${p.targetType}:${p.targetId}`;
        const list = paymentsByTarget.get(key) ?? [];
        list.push(p);
        paymentsByTarget.set(key, list);
    }
    const now = new Date();
    let totalReceivables = 0;
    let totalPayables = 0;
    let receivablesOverdueCount = 0;
    let receivablesPendingCount = 0;
    let payablesOverdueCount = 0;
    let payablesPendingCount = 0;
    const overdueReceivables = [];
    const overduePayables = [];
    // Receivables: income transactions con status != paid
    for (const t of transactions) {
        if (t.type !== 'income')
            continue;
        if (t.status === 'paid')
            continue;
        const txPayments = paymentsByTarget.get(`transaction:${t.id}`) ?? [];
        const paidAmount = txPayments.reduce((s, p) => s + p.amount, 0);
        const commissionAmount = txPayments.reduce((s, p) => s + (p.commission ?? 0), 0);
        const balance = Math.max(t.amount - paidAmount - commissionAmount, 0);
        if (balance <= 0)
            continue;
        totalReceivables += balance;
        const isOverdue = t.status === 'overdue';
        if (isOverdue) {
            receivablesOverdueCount += 1;
            const txDate = tsToDate(t.date) ?? now;
            const days = daysBetween(txDate, now);
            overdueReceivables.push({
                id: t.id,
                concept: t.concept ?? t.sourceLabel ?? t.category ?? 'Sin concepto',
                balance,
                daysOutstanding: days,
            });
        }
        else {
            receivablesPendingCount += 1;
        }
    }
    // Payables: purchases con paymentStatus != paid
    for (const p of purchases) {
        if (p.paymentStatus === 'paid')
            continue;
        const purPayments = paymentsByTarget.get(`purchase:${p.id}`) ?? [];
        const paidAmount = purPayments.reduce((s, py) => s + py.amount, 0);
        const commissionAmount = purPayments.reduce((s, py) => s + (py.commission ?? 0), 0);
        const balance = Math.max(p.total - paidAmount - commissionAmount, 0);
        if (balance <= 0)
            continue;
        totalPayables += balance;
        const dueDate = tsToDate(p.paymentDueDate);
        const isOverdue = p.paymentStatus === 'overdue' || (dueDate ? dueDate < now : false);
        if (isOverdue) {
            payablesOverdueCount += 1;
            const purDate = tsToDate(p.date) ?? now;
            const days = daysBetween(purDate, now);
            overduePayables.push({
                id: p.id,
                concept: p.invoiceNumber
                    ? `Compra #${p.invoiceNumber} - ${p.supplierName ?? ''}`.trim()
                    : `Compra - ${p.supplierName ?? ''}`.trim(),
                balance,
                daysOutstanding: days,
            });
        }
        else {
            payablesPendingCount += 1;
        }
    }
    // Top N por balance (mayor primero)
    overdueReceivables.sort((a, b) => b.balance - a.balance);
    overduePayables.sort((a, b) => b.balance - a.balance);
    const overdueTotal = overdueReceivables.reduce((s, r) => s + r.balance, 0) +
        overduePayables.reduce((s, p) => s + p.balance, 0);
    const doc = {
        totalReceivables,
        totalPayables,
        netPosition: totalReceivables - totalPayables,
        overdueTotal,
        receivablesOverdueCount,
        receivablesPendingCount,
        payablesOverdueCount,
        payablesPendingCount,
        overdueReceivables: overdueReceivables.slice(0, TOP_OVERDUE_LIMIT),
        overduePayables: overduePayables.slice(0, TOP_OVERDUE_LIMIT),
        computedAt: FieldValue.serverTimestamp(),
    };
    await companyRef.collection('summary').doc('cartera').set(doc);
}
async function getAllCompanyIds() {
    const snapshot = await db.collection('companies').get();
    return snapshot.docs.map((d) => d.id);
}
// Cron nocturno: recompute para todas las companies a las 3am hora Bogotá.
// Una sola hora porque la operación lee 3 colecciones por company; con N
// companies puede tardar 1-2 min total — hacerlo de noche evita pico.
export const carteraSummaryNightly = onSchedule({
    schedule: 'every day 03:00',
    timeZone: 'America/Bogota',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
}, async () => {
    const companyIds = await getAllCompanyIds();
    let ok = 0;
    let fail = 0;
    for (const id of companyIds) {
        try {
            await recomputeCarteraSummary(id);
            ok += 1;
        }
        catch (err) {
            fail += 1;
            // eslint-disable-next-line no-console
            console.error(`[carteraSummaryNightly] company=${id}`, err);
        }
    }
    // eslint-disable-next-line no-console
    console.log(`[carteraSummaryNightly] done: ${ok} ok, ${fail} fail`);
});
// Callable para recompute on-demand desde el cliente (botón "Refrescar
// resumen" en cartera o tras una mutación importante). El cliente debe
// pasar companyId; la regla de seguridad implícita es que el caller esté
// autenticado.
export const recomputeCarteraSummaryCallable = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 120 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login requerido');
    }
    const companyId = request.data?.companyId;
    if (!companyId || typeof companyId !== 'string') {
        throw new HttpsError('invalid-argument', 'companyId requerido');
    }
    await recomputeCarteraSummary(companyId);
    return { ok: true };
});
//# sourceMappingURL=cartera-summary.js.map