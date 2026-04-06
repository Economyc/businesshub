import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { db } from './firestore.js';
function tsToDate(val) {
    if (!val)
        return null;
    if (typeof val === 'object' && val !== null && '_seconds' in val) {
        return new Date(val._seconds * 1000);
    }
    return null;
}
function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function addFrequency(date, frequency) {
    const next = new Date(date);
    switch (frequency) {
        case 'daily':
            next.setDate(next.getDate() + 1);
            break;
        case 'weekly':
            next.setDate(next.getDate() + 7);
            break;
        case 'monthly':
            next.setMonth(next.getMonth() + 1);
            break;
        case 'yearly':
            next.setFullYear(next.getFullYear() + 1);
            break;
    }
    return next;
}
function formatDateLabel(date) {
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}
/**
 * Genera transacciones pendientes a partir de recurrentes activas.
 * Versión server-side usando Admin SDK.
 */
export async function generatePendingTransactionsServer(companyId) {
    const recurringSnap = await db
        .collection('companies')
        .doc(companyId)
        .collection('recurring-transactions')
        .get();
    const allRecurring = recurringSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const active = allRecurring.filter((r) => r.isActive === true);
    const today = startOfDay(new Date());
    let generated = 0;
    const txCollection = db.collection('companies').doc(companyId).collection('transactions');
    const recurringCollection = db.collection('companies').doc(companyId).collection('recurring-transactions');
    for (const recurring of active) {
        const endDate = tsToDate(recurring.endDate);
        if (endDate && startOfDay(endDate) < today)
            continue;
        let nextDue = tsToDate(recurring.nextDueDate);
        if (!nextDue)
            continue;
        let lastGenerated = tsToDate(recurring.lastGeneratedDate) ?? null;
        let hasChanges = false;
        while (startOfDay(nextDue) <= today) {
            if (endDate && startOfDay(nextDue) > startOfDay(endDate))
                break;
            await txCollection.add({
                concept: recurring.concept,
                category: recurring.category,
                amount: recurring.amount,
                type: recurring.type,
                date: Timestamp.fromDate(nextDue),
                status: recurring.status || 'pending',
                notes: recurring.notes || null,
                sourceType: 'recurring',
                sourceId: recurring.id,
                sourceLabel: `Recurrente — ${formatDateLabel(nextDue)}`,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            lastGenerated = nextDue;
            nextDue = addFrequency(nextDue, recurring.frequency);
            hasChanges = true;
            generated++;
        }
        if (hasChanges) {
            await recurringCollection.doc(recurring.id).update({
                nextDueDate: Timestamp.fromDate(nextDue),
                ...(lastGenerated ? { lastGeneratedDate: Timestamp.fromDate(lastGenerated) } : {}),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
    }
    return generated;
}
/**
 * Cuenta cuántas transacciones recurrentes se generarían (dry-run).
 * Útil para previews sin escribir datos.
 */
export async function countPendingRecurring(companyId) {
    const recurringSnap = await db
        .collection('companies')
        .doc(companyId)
        .collection('recurring-transactions')
        .get();
    const allRecurring = recurringSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const active = allRecurring.filter((r) => r.isActive === true);
    const today = startOfDay(new Date());
    let count = 0;
    for (const recurring of active) {
        const endDate = tsToDate(recurring.endDate);
        if (endDate && startOfDay(endDate) < today)
            continue;
        let nextDue = tsToDate(recurring.nextDueDate);
        if (!nextDue)
            continue;
        while (startOfDay(nextDue) <= today) {
            if (endDate && startOfDay(nextDue) > startOfDay(endDate))
                break;
            nextDue = addFrequency(nextDue, recurring.frequency);
            count++;
        }
    }
    return count;
}
//# sourceMappingURL=recurring-generator.js.map