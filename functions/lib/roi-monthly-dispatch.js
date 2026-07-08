// Cron mensual de ROI de socios. El día 1 de cada mes genera los ROI
// PENDIENTES del mes que acaba de terminar (mes vencido) en cada company,
// copiando socios y montos del último mes con ROIs registrados. El ROI se
// trata como responsabilidad de la operación: se genera como gasto pendiente
// para que sí o sí entre al flujo de pagos (aparece en /facturacion/roi de
// Ecore y en el PDF diario de pagos pendientes).
//
// Comportamiento emergente intencional: borrar el pendiente de un socio un
// mes lo saca de la copia del mes siguiente; editar un monto propaga el nuevo
// valor. Idempotente por socio+mes: un socio que ya tiene ROI (cualquier
// status) en el mes objetivo no se duplica, así re-correr el cron o registrar
// uno a mano antes del día 1 es seguro.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { db, createDocumentInCollection } from './firestore.js';
const ROI_CATEGORY = 'ROI socios';
const MESES_ES = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
];
/** Clave ordenable de mes devengado: año*12 + mes (0-indexed). */
function monthKey(d) {
    return d.getFullYear() * 12 + d.getMonth();
}
function monthLabel(key) {
    return `${MESES_ES[key % 12]} ${Math.floor(key / 12)}`;
}
export async function generateRoiForCompany(companyId, now) {
    const snap = await db
        .collection('companies')
        .doc(companyId)
        .collection('transactions')
        .where('documentKind', '==', 'roi')
        .get();
    if (snap.empty)
        return 0; // la company no maneja ROI
    // Mes objetivo = mes calendario anterior. El cron corre a las 06:00 Bogotá
    // (= 11:00 UTC), misma fecha calendario en ambas zonas, así que `now` del
    // servidor es seguro para derivar el mes.
    const targetKey = monthKey(now) - 1;
    // Agrupar ROIs existentes por mes devengado (accrualDate).
    const byMonth = new Map();
    for (const doc of snap.docs) {
        const tx = doc.data();
        const accrual = tx.accrualDate?.toDate?.();
        if (!accrual)
            continue;
        const key = monthKey(accrual);
        const list = byMonth.get(key) ?? [];
        list.push(tx);
        byMonth.set(key, list);
    }
    // Mes fuente = el más reciente estrictamente anterior al objetivo.
    const sourceKey = Math.max(...[...byMonth.keys()].filter((k) => k < targetKey).concat(-Infinity));
    if (sourceKey === -Infinity)
        return 0;
    // Un ROI por socio: si el mes fuente tiene varios del mismo socio, se suman.
    const bySocio = new Map();
    for (const tx of byMonth.get(sourceKey) ?? []) {
        const id = tx.payeeRef?.id;
        if (!id)
            continue;
        const entry = bySocio.get(id) ?? { payeeRef: tx.payeeRef, amount: 0 };
        entry.amount += Number(tx.amount) || 0;
        bySocio.set(id, entry);
    }
    // Idempotencia: socios que ya tienen ROI en el mes objetivo no se duplican.
    const yaGenerados = new Set((byMonth.get(targetKey) ?? []).map((tx) => tx.payeeRef?.id).filter(Boolean));
    const targetYear = Math.floor(targetKey / 12);
    const targetMonth = targetKey % 12;
    let generated = 0;
    for (const [id, { payeeRef, amount }] of bySocio) {
        if (yaGenerados.has(id) || amount <= 0)
            continue;
        await createDocumentInCollection(companyId, 'transactions', {
            concept: `ROI ${MESES_ES[targetMonth]} ${targetYear} — ${payeeRef.name ?? ''}`,
            category: ROI_CATEGORY,
            amount,
            type: 'expense',
            status: 'pending',
            documentKind: 'roi',
            payeeRef,
            accrualDate: Timestamp.fromDate(new Date(targetYear, targetMonth, 1, 12, 0, 0)),
            date: Timestamp.now(),
            sourceType: 'roi-monthly',
        });
        generated++;
    }
    if (generated > 0) {
        console.log(`[roi-monthly] ${companyId}: ${generated} generados para ${monthLabel(targetKey)} (fuente ${monthLabel(sourceKey)})`);
    }
    return generated;
}
export const dispatchRoiMonthly = onSchedule({
    schedule: '0 6 1 * *',
    timeZone: 'America/Bogota',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
    retryCount: 1, // si falla se pierde un mes entero → un reintento
}, async () => {
    const companies = await db.collection('companies').get();
    const now = new Date();
    let total = 0;
    let failed = 0;
    for (const company of companies.docs) {
        try {
            total += await generateRoiForCompany(company.id, now);
        }
        catch (err) {
            failed++;
            console.error(`[roi-monthly] ${company.id} falló:`, err);
        }
    }
    console.log(`[roi-monthly] total generados=${total} companies=${companies.size} fallidas=${failed}`);
});
//# sourceMappingURL=roi-monthly-dispatch.js.map