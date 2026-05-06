// Wave 5.1 — Detección automática de anomalías.
//
// Cron diario que recorre todas las companies y detecta tres tipos de anomalía:
//   1. Gasto > media + 2σ del histórico (90 días) por categoría.
//   2. Caída de ventas semana vs semana (esta < 80% de la pasada).
//   3. Contratos venciendo en los próximos 30 días.
//
// Cada anomalía detectada genera un doc en
// `companies/{companyId}/notifications/{deterministicId}` con campos compatibles
// con el sistema de notificaciones existente (type, title, summary, read,
// createdAt, updatedAt). Se añaden campos extra (severity, evidence,
// acknowledged) que el cliente puede ignorar sin problema.
//
// Idempotencia: el ID se construye como `anomaly-{date}-{kind}-{hash}` para que
// reejecutar el cron el mismo día no duplique notificaciones.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { db, fetchCollection } from './firestore.js';
import { SALES_COLLECTION } from './pos-cache.js';
// ─── Helpers ───
function tsToDate(val) {
    if (!val)
        return null;
    if (typeof val === 'object' && val !== null && '_seconds' in val) {
        return new Date(val._seconds * 1000);
    }
    if (val instanceof Date)
        return val;
    return null;
}
function isoDay(d) {
    return d.toISOString().split('T')[0];
}
function num(v) {
    if (v === null || v === undefined)
        return 0;
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
}
function shortHash(input) {
    return createHash('sha1').update(input).digest('hex').slice(0, 10);
}
function fmtCop(amount) {
    return `$${Math.round(amount).toLocaleString('es-CO')}`;
}
async function getAllCompanyIds() {
    const snapshot = await db.collection('companies').get();
    return snapshot.docs.map((d) => d.id);
}
async function writeAnomaly(companyId, runDate, payload) {
    const id = `anomaly-${runDate}-${payload.kind}-${shortHash(payload.hashSeed)}`;
    const ref = db
        .collection('companies')
        .doc(companyId)
        .collection('notifications')
        .doc(id);
    // Idempotencia: si ya existe (mismo día, mismo evento), no sobreescribimos.
    const existing = await ref.get();
    if (existing.exists)
        return;
    await ref.set({
        type: 'anomaly',
        severity: payload.severity,
        title: payload.title,
        // `summary` lo consume el bell del cliente; `description` queda igual para
        // tools que se entrenan con el campo más explícito.
        summary: payload.description,
        description: payload.description,
        evidence: payload.evidence,
        acknowledged: false,
        read: false,
        data: payload.evidence,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
}
function collectExpenses(raw, windowStart, windowEnd) {
    const out = [];
    for (const t of raw) {
        if (t.type !== 'expense')
            continue;
        const d = tsToDate(t.date);
        if (!d)
            continue;
        if (d < windowStart || d > windowEnd)
            continue;
        const amount = num(t.amount);
        if (amount <= 0)
            continue;
        out.push({
            id: String(t.id),
            category: String(t.category ?? 'Sin categoría'),
            amount,
            date: d,
        });
    }
    return out;
}
async function detectExpenseOutliers(companyId, runDate, now) {
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const all = await fetchCollection(companyId, 'transactions');
    const history = collectExpenses(all, ninetyDaysAgo, now);
    if (history.length === 0)
        return 0;
    // Estadísticas por categoría sobre los 90 días.
    const byCat = new Map();
    for (const e of history) {
        const arr = byCat.get(e.category) ?? [];
        arr.push(e.amount);
        byCat.set(e.category, arr);
    }
    const stats = new Map();
    for (const [cat, amounts] of byCat) {
        if (amounts.length < 5)
            continue; // sin suficientes muestras, no juzgamos
        const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
        const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
        const stddev = Math.sqrt(variance);
        if (stddev <= 0)
            continue;
        stats.set(cat, { mean, stddev, n: amounts.length });
    }
    // Revisamos transacciones de los últimos 7 días contra el modelo.
    const recent = history.filter((e) => e.date >= sevenDaysAgo);
    let written = 0;
    for (const tx of recent) {
        const stat = stats.get(tx.category);
        if (!stat)
            continue;
        const threshold = stat.mean + 2 * stat.stddev;
        if (tx.amount <= threshold)
            continue;
        const sigmas = stat.stddev > 0 ? (tx.amount - stat.mean) / stat.stddev : 0;
        await writeAnomaly(companyId, runDate, {
            kind: 'expense-outlier',
            severity: 'warning',
            title: `Gasto inusual en ${tx.category}`,
            description: `Una transacción del ${isoDay(tx.date)} por ${fmtCop(tx.amount)} en "${tx.category}" supera la media histórica (${fmtCop(stat.mean)}) en ${sigmas.toFixed(1)}σ.`,
            evidence: {
                transactionId: tx.id,
                category: tx.category,
                amount: tx.amount,
                transactionDate: isoDay(tx.date),
                historicalMean: Math.round(stat.mean),
                historicalStddev: Math.round(stat.stddev),
                sampleSize: stat.n,
                threshold: Math.round(threshold),
                sigmas: Math.round(sigmas * 100) / 100,
            },
            hashSeed: `expense-outlier:${tx.id}`,
        });
        written++;
    }
    return written;
}
// ─── Anomalía 2: ventas caídas semana vs semana ───
async function detectSalesDrop(companyId, runDate, now) {
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(lastWeekStart.getDate() - 14);
    const isoNow = isoDay(now);
    const isoThisStart = isoDay(thisWeekStart);
    const isoLastStart = isoDay(lastWeekStart);
    // pos-sales-cache está indexado por `date` (string YYYY-MM-DD).
    const snap = await db
        .collection('companies')
        .doc(companyId)
        .collection(SALES_COLLECTION)
        .where('date', '>=', isoLastStart)
        .where('date', '<=', isoNow)
        .get();
    if (snap.empty)
        return 0;
    let thisWeekTotal = 0;
    let lastWeekTotal = 0;
    let thisWeekCount = 0;
    let lastWeekCount = 0;
    for (const doc of snap.docs) {
        const data = doc.data();
        const date = data.date;
        if (!date)
            continue;
        const ventas = Array.isArray(data.ventas) ? data.ventas : [];
        const total = ventas.reduce((s, v) => s + num(v.total), 0);
        if (date >= isoThisStart && date <= isoNow) {
            thisWeekTotal += total;
            thisWeekCount += ventas.length;
        }
        else if (date >= isoLastStart && date < isoThisStart) {
            lastWeekTotal += total;
            lastWeekCount += ventas.length;
        }
    }
    // Sin baseline o si el local no factura por POS, no hay anomalía que reportar.
    if (lastWeekTotal <= 0)
        return 0;
    const ratio = thisWeekTotal / lastWeekTotal;
    if (ratio >= 0.8)
        return 0;
    const dropPct = Math.round((1 - ratio) * 100);
    await writeAnomaly(companyId, runDate, {
        kind: 'sales-drop',
        severity: 'warning',
        title: `Ventas POS caídas ${dropPct}% semana vs semana`,
        description: `Las ventas de la última semana (${fmtCop(thisWeekTotal)}) están ${dropPct}% por debajo de la semana anterior (${fmtCop(lastWeekTotal)}). Revisa locales y métodos de pago para descartar problemas operativos.`,
        evidence: {
            thisWeekStart: isoThisStart,
            thisWeekEnd: isoNow,
            lastWeekStart: isoLastStart,
            lastWeekEnd: isoDay(new Date(thisWeekStart.getTime() - 86400000)),
            thisWeekTotal: Math.round(thisWeekTotal),
            lastWeekTotal: Math.round(lastWeekTotal),
            thisWeekVentasCount: thisWeekCount,
            lastWeekVentasCount: lastWeekCount,
            ratio: Math.round(ratio * 100) / 100,
            dropPercent: dropPct,
        },
        // Una sola anomalía de sales-drop por semana — el seed usa el inicio de la
        // ventana actual, así que reejecutar el cron el mismo día no duplica.
        hashSeed: `sales-drop:${isoThisStart}`,
    });
    return 1;
}
// ─── Anomalía 3: contratos venciendo en <30 días ───
async function detectExpiringContracts(companyId, runDate, now) {
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 30);
    const contracts = await fetchCollection(companyId, 'contracts');
    let written = 0;
    for (const c of contracts) {
        const end = tsToDate(c.endDate);
        if (!end)
            continue;
        if (end < now || end > horizon)
            continue;
        const status = String(c.status ?? '').toLowerCase();
        // Saltamos contratos ya terminados o anulados.
        if (status === 'terminated' || status === 'cancelled' || status === 'cancelado')
            continue;
        const employeeName = String(c.employeeName ?? 'empleado sin nombre');
        const position = String(c.position ?? '');
        const days = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        await writeAnomaly(companyId, runDate, {
            kind: 'contract-expiring',
            severity: days <= 7 ? 'warning' : 'info',
            title: `Contrato de ${employeeName} vence en ${days} días`,
            description: `El contrato${position ? ` (${position})` : ''} vence el ${isoDay(end)}. Renueva o termina antes de la fecha para evitar exposición legal.`,
            evidence: {
                contractId: String(c.id),
                employeeName,
                employeeId: c.employeeId ?? null,
                position,
                endDate: isoDay(end),
                daysUntilExpiry: days,
                status: c.status ?? null,
            },
            // Una alerta por contrato y día — si el cron se ejecuta dos veces hoy, el
            // segundo intento encuentra el doc y se salta.
            hashSeed: `contract-expiring:${String(c.id)}`,
        });
        written++;
    }
    return written;
}
// ─── Cron principal ───
export const detectAnomaliesDaily = onSchedule({
    schedule: '0 7 * * *',
    timeZone: 'America/Bogota',
    timeoutSeconds: 540,
    memory: '512MiB',
}, async () => {
    const now = new Date();
    const runDate = isoDay(now);
    const companyIds = await getAllCompanyIds();
    const summary = {
        companies: companyIds.length,
        expenseOutliers: 0,
        salesDrops: 0,
        contractExpirations: 0,
        errors: 0,
    };
    for (const companyId of companyIds) {
        try {
            const [exp, sales, contracts] = await Promise.all([
                detectExpenseOutliers(companyId, runDate, now).catch((err) => {
                    console.error(`[Anomalies] expense-outlier failed for ${companyId}:`, err);
                    return 0;
                }),
                detectSalesDrop(companyId, runDate, now).catch((err) => {
                    console.error(`[Anomalies] sales-drop failed for ${companyId}:`, err);
                    return 0;
                }),
                detectExpiringContracts(companyId, runDate, now).catch((err) => {
                    console.error(`[Anomalies] contract-expiring failed for ${companyId}:`, err);
                    return 0;
                }),
            ]);
            summary.expenseOutliers += exp;
            summary.salesDrops += sales;
            summary.contractExpirations += contracts;
        }
        catch (error) {
            summary.errors++;
            console.error(`[Anomalies] Unexpected failure for ${companyId}:`, error);
        }
    }
    console.log(`[Anomalies] run=${runDate}`, summary);
});
//# sourceMappingURL=anomaly-detection.js.map