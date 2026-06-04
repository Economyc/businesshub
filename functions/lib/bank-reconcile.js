// Callable que concilia un extracto bancario ya importado (Fase 2) contra los
// cierres de caja y la venta Rappi del POS, y deriva automáticamente:
//   - la comisión de Rappi  (venta bruta POS − depósito neto banco)
//   - la retención del datáfono (venta datáfono de cierres − abono neto banco)
// como transacciones `expense`. NUNCA crea ingresos (el bruto ya entró vía los
// cierres) ⇒ sin doble conteo en el P&L.
//
// Los números y el cuadre son CÓDIGO DETERMINISTA. El LLM solo se usa para
// etiquetar el texto de la descripción de las entradas que la heurística no
// pudo clasificar (tarjeta_credito | rappi | otro). Si no hay datos para
// cuadrar (POS incompleto, sin cierres) NO se inventa plata: el movimiento
// queda `partial` para revisión humana.
//
// Idempotente por `splitGroupId` (patrón transaction-sync.ts del cliente):
// recorrer dos veces reemplaza, no duplica.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { generateObject } from 'ai';
import { z } from 'zod';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from './firestore.js';
import { CALLABLE_CORS_ORIGINS } from './cors-origins.js';
import { SALES_COLLECTION } from './pos-cache.js';
import { LLMRouter, isRateLimitError, isCreditDepletedError, parseRetryAfter, } from './llm-router.js';
import { reportProgress } from './tools/utils/tool-progress.js';
const geminiApiKey = defineSecret('GEMINI_API_KEY');
const groqApiKey = defineSecret('GROQ_API_KEY');
const cerebrasApiKey = defineSecret('CEREBRAS_API_KEY');
const BANK_MOVEMENTS = 'bank-movements';
const BANK_STATEMENTS = 'bank-statements';
const CLOSINGS = 'closings';
const TRANSACTIONS = 'transactions';
const BATCH_LIMIT = 450;
const CAT_RAPPI = 'Comisión plataformas > Rappi';
const CAT_TC_RETENCION = 'Impuestos > Retenciones';
async function assertCompanyMember(uid, companyId) {
    const snap = await db
        .collection('companies')
        .doc(companyId)
        .collection('members')
        .doc(uid)
        .get();
    if (!snap.exists) {
        throw new HttpsError('permission-denied', 'No eres miembro de esta empresa');
    }
    if (snap.data().status !== 'active') {
        throw new HttpsError('permission-denied', 'Tu cuenta no está activa en esta empresa');
    }
}
function num(v) {
    if (v === null || v === undefined)
        return 0;
    const n = typeof v === 'string' ? parseFloat(v.replace(/[^\d.-]/g, '')) : Number(v);
    return Number.isFinite(n) ? n : 0;
}
function tsToISO(val) {
    if (val && typeof val === 'object' && '_seconds' in val) {
        return new Date(val._seconds * 1000).toISOString().slice(0, 10);
    }
    if (val && typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
        return val.toDate().toISOString().slice(0, 10);
    }
    return null;
}
// ── Detección de canal Rappi en una venta cruda del POS ─────────────
const RAPPI_RE = /rappi/i;
function ventaIsRappi(v) {
    const fields = [
        v.nombre_canaldelivery,
        v.canaldelivery_descripcion,
        v.canal_delivery,
        v.tipo_pago,
    ];
    if (fields.some((f) => typeof f === 'string' && RAPPI_RE.test(f)))
        return true;
    const pagos = Array.isArray(v.pagosList) ? v.pagosList : [];
    return pagos.some((p) => (typeof p.tipoPago === 'string' && RAPPI_RE.test(p.tipoPago)) ||
        (typeof p.nombre === 'string' && RAPPI_RE.test(p.nombre)));
}
// ── Clasificación heurística de la descripción de una entrada ───────
const TC_RE = /(redeban|credibanco|datafono|datáfono|\bp\.?o\.?s\b|tarjeta|visa|master|amex|recaudo|pago electr|datafonos|bancolombia.*pos|venta.*tarjeta)/i;
function classifyDescription(desc) {
    const d = desc || '';
    if (RAPPI_RE.test(d))
        return 'rappi';
    if (TC_RE.test(d))
        return 'tarjeta_credito';
    return null; // ambiguo → LLM
}
// ── LLM solo para etiquetar texto ambiguo (text-only, con fallback) ──
const LabelSchema = z.object({
    labels: z
        .array(z.object({
        i: z.number().describe('Índice de la entrada tal como se listó.'),
        label: z
            .enum(['tarjeta_credito', 'rappi', 'otro'])
            .describe('tarjeta_credito = abono de datáfono/pasarela de tarjetas; rappi = depósito de Rappi; otro = cualquier otra cosa.'),
    }))
        .describe('Una etiqueta por cada entrada listada.'),
});
let router = null;
function getRouter() {
    if (!router) {
        router = new LLMRouter()
            .addGemini(geminiApiKey.value())
            .addGroq(groqApiKey.value())
            .addCerebras(cerebrasApiKey.value());
    }
    return router;
}
async function labelWithLLM(descriptions) {
    const out = new Map();
    if (descriptions.length === 0)
        return out;
    const prompt = 'Eres un asistente contable. Clasifica cada ENTRADA bancaria (abono) por su descripción en una de:\n' +
        '- "tarjeta_credito": abono de un datáfono / pasarela de tarjetas (Redeban, Credibanco, recaudo POS).\n' +
        '- "rappi": depósito proveniente de Rappi.\n' +
        '- "otro": transferencia, devolución, intereses, traslado, o cualquier otra cosa.\n' +
        'Responde SOLO con la lista de etiquetas, una por índice. No inventes.\n\n' +
        'Entradas:\n' +
        descriptions.map((d) => `${d.i}: ${d.desc || '(sin descripción)'}`).join('\n');
    const r = getRouter();
    const tried = new Set();
    for (let attempt = 0; attempt < 3; attempt++) {
        let modelInfo;
        try {
            modelInfo = await r.getModel({ needsVision: false, exclude: tried });
        }
        catch {
            break;
        }
        tried.add(modelInfo.provider);
        try {
            const result = await generateObject({
                model: modelInfo.model,
                schema: LabelSchema,
                messages: [{ role: 'user', content: prompt }],
            });
            for (const l of result.object.labels) {
                out.set(l.i, l.label);
            }
            return out;
        }
        catch (err) {
            if (isCreditDepletedError(err)) {
                await r.markRateLimited(modelInfo.provider, 6 * 60 * 60 * 1000, 'credits depleted');
            }
            else if (isRateLimitError(err)) {
                await r.markRateLimited(modelInfo.provider, parseRetryAfter(err), 'bank-reconcile 429');
            }
            else {
                await r.markRateLimited(modelInfo.provider, 30_000, 'bank-reconcile error');
            }
        }
    }
    // Si el LLM no respondió, los ambiguos quedan sin clasificar (→ 'otro').
    return out;
}
async function deleteBySplitGroup(companyId, groupId) {
    const ref = db.collection('companies').doc(companyId).collection(TRANSACTIONS);
    const snap = await ref.where('splitGroupId', '==', groupId).get();
    if (snap.empty)
        return;
    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
        const b = db.batch();
        snap.docs.slice(i, i + BATCH_LIMIT).forEach((d) => b.delete(d.ref));
        await b.commit();
    }
}
async function createExpense(companyId, params) {
    const ref = db.collection('companies').doc(companyId).collection(TRANSACTIONS).doc();
    const dateTs = Timestamp.fromDate(new Date(`${params.dateISO}T12:00:00`));
    await ref.set({
        concept: params.concept,
        category: params.category,
        amount: Math.round(params.amount),
        type: 'expense',
        date: dateTs,
        status: 'paid',
        paidDate: dateTs,
        notes: params.notes,
        splitGroupId: params.splitGroupId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
}
export const reconcileBankStatement = onCall({
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 300,
    secrets: [geminiApiKey, groqApiKey, cerebrasApiKey],
    cors: CALLABLE_CORS_ORIGINS,
}, async (req) => {
    if (!req.auth)
        throw new HttpsError('unauthenticated', 'Login requerido');
    const { companyId, statementId: inputStatementId, toolCallId } = req.data ?? {};
    if (!companyId)
        throw new HttpsError('invalid-argument', 'companyId requerido');
    await assertCompanyMember(req.auth.uid, companyId);
    const companyRef = db.collection('companies').doc(companyId);
    // 1. Resolver el statement.
    let statementId = inputStatementId;
    if (!statementId) {
        const pend = await companyRef
            .collection(BANK_STATEMENTS)
            .where('status', '==', 'imported')
            .get();
        if (pend.empty) {
            throw new HttpsError('failed-precondition', 'No hay extractos importados para conciliar.');
        }
        // El más reciente por periodEnd.
        const sorted = pend.docs.sort((a, b) => {
            const ae = tsToISO(a.data().periodEnd) ?? '';
            const be = tsToISO(b.data().periodEnd) ?? '';
            return be.localeCompare(ae);
        });
        statementId = sorted[0].id;
    }
    const stmtSnap = await companyRef.collection(BANK_STATEMENTS).doc(statementId).get();
    if (!stmtSnap.exists) {
        throw new HttpsError('not-found', `Extracto ${statementId} no encontrado.`);
    }
    const stmt = stmtSnap.data();
    const periodStart = tsToISO(stmt.periodStart);
    const periodEnd = tsToISO(stmt.periodEnd);
    if (!periodStart || !periodEnd) {
        throw new HttpsError('failed-precondition', 'El extracto no tiene un periodo válido.');
    }
    void reportProgress(toolCallId, { label: 'Cargando movimientos y cierres', status: 'running' });
    // 2. Movimientos del statement.
    const movSnap = await companyRef
        .collection(BANK_MOVEMENTS)
        .where('statementId', '==', statementId)
        .get();
    const movements = movSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    }));
    const inflows = movements.filter((m) => m.direction === 'in');
    // 3. Cierres del periodo (date es string YYYY-MM-DD).
    const closingsSnap = await companyRef
        .collection(CLOSINGS)
        .where('date', '>=', periodStart)
        .where('date', '<=', periodEnd)
        .get();
    let sumDatafonoClosings = 0;
    for (const c of closingsSnap.docs) {
        sumDatafonoClosings += num(c.data().datafono);
    }
    const closingsCount = closingsSnap.size;
    // 4. Venta bruta Rappi del POS en el periodo (decisión: el bruto es el POS).
    void reportProgress(toolCallId, { label: 'Sumando venta Rappi del POS', status: 'running' });
    const salesSnap = await companyRef
        .collection(SALES_COLLECTION)
        .where('date', '>=', periodStart)
        .where('date', '<=', periodEnd)
        .get();
    let posRappiGross = 0;
    let posVentasSeen = 0;
    for (const doc of salesSnap.docs) {
        const data = doc.data();
        const ventas = Array.isArray(data.ventas) ? data.ventas : [];
        posVentasSeen += ventas.length;
        for (const v of ventas) {
            // Excluir comprobantes anulados: el banco nunca depositó esas ventas.
            // Mismo filtro canónico que el KPI de ventas POS (cache-service.ts).
            const estado = String(v.estado_txt ?? '').toLowerCase();
            if (estado === 'comprobante anulado')
                continue;
            if (ventaIsRappi(v))
                posRappiGross += num(v.total);
        }
    }
    // 5. Clasificar SOLO entradas. Heurística → LLM para los ambiguos.
    void reportProgress(toolCallId, { label: 'Clasificando entradas', status: 'running' });
    const classification = new Map();
    const ambiguous = [];
    inflows.forEach((m, idx) => {
        const c = classifyDescription(m.description ?? '');
        if (c)
            classification.set(m.id, c);
        else
            ambiguous.push({ i: idx, desc: m.description ?? '', id: m.id });
    });
    if (ambiguous.length > 0) {
        const labels = await labelWithLLM(ambiguous.map(({ i, desc }) => ({ i, desc })));
        for (const a of ambiguous) {
            classification.set(a.id, labels.get(a.i) ?? 'otro');
        }
    }
    const rappiInflows = inflows.filter((m) => classification.get(m.id) === 'rappi');
    const tcInflows = inflows.filter((m) => classification.get(m.id) === 'tarjeta_credito');
    const bankRappiNet = rappiInflows.reduce((s, m) => s + num(m.amount), 0);
    const bankTcNet = tcInflows.reduce((s, m) => s + num(m.amount), 0);
    // 6. Cuadre determinista. Solo se crean GASTOS (jamás ingresos).
    void reportProgress(toolCallId, { label: 'Cuadrando y derivando gastos', status: 'running' });
    const rappiGroupId = `rappi-${statementId}`;
    const tcGroupId = `tc-${statementId}`;
    await deleteBySplitGroup(companyId, rappiGroupId);
    await deleteBySplitGroup(companyId, tcGroupId);
    const derived = [];
    const notesPos = `Periodo ${periodStart}..${periodEnd}.`;
    // Rappi: comisión = venta bruta POS − depósito neto banco.
    let rappiCommission = 0;
    let rappiStatus = 'skipped';
    if (posRappiGross > 0 && bankRappiNet > 0) {
        rappiCommission = Math.round(posRappiGross - bankRappiNet);
        if (rappiCommission > 0) {
            const txId = await createExpense(companyId, {
                concept: `Comisión Rappi ${periodStart} a ${periodEnd}`,
                category: CAT_RAPPI,
                amount: rappiCommission,
                dateISO: periodEnd,
                splitGroupId: rappiGroupId,
                notes: `${notesPos} Venta bruta POS ${Math.round(posRappiGross)} − depósito banco ${Math.round(bankRappiNet)}. Derivado automáticamente; el ingreso bruto ya está vía cierres.`,
            });
            derived.push({ type: 'comision_rappi', amount: rappiCommission, transactionId: txId });
            rappiStatus = 'derived';
        }
        else {
            rappiStatus = 'partial'; // banco depositó >= bruto POS: no cuadra, revisar.
        }
    }
    else if (rappiInflows.length > 0 || posRappiGross > 0) {
        rappiStatus = 'partial'; // hay señal de Rappi pero falta un lado del cuadre.
    }
    // Datáfono / TC: retención = venta datáfono cierres − abono neto banco.
    let tcRetencion = 0;
    let tcStatus = 'skipped';
    if (sumDatafonoClosings > 0 && bankTcNet > 0) {
        tcRetencion = Math.round(sumDatafonoClosings - bankTcNet);
        if (tcRetencion > 0) {
            const txId = await createExpense(companyId, {
                concept: `Retención datáfono ${periodStart} a ${periodEnd}`,
                category: CAT_TC_RETENCION,
                amount: tcRetencion,
                dateISO: periodEnd,
                splitGroupId: tcGroupId,
                notes: `${notesPos} Venta datáfono cierres ${Math.round(sumDatafonoClosings)} − abono banco ${Math.round(bankTcNet)}. El ingreso ya está vía cierres.`,
            });
            derived.push({ type: 'retencion_tc', amount: tcRetencion, transactionId: txId });
            tcStatus = 'derived';
        }
        else {
            tcStatus = 'partial';
        }
    }
    else if (tcInflows.length > 0 || sumDatafonoClosings > 0) {
        tcStatus = 'partial';
    }
    // 7. Marcar movimientos (estado de conciliación + clasificación).
    for (let i = 0; i < inflows.length; i += BATCH_LIMIT) {
        const b = db.batch();
        for (const m of inflows.slice(i, i + BATCH_LIMIT)) {
            const cls = classification.get(m.id) ?? 'otro';
            let status;
            let derivedIds = [];
            if (cls === 'rappi') {
                status = rappiStatus === 'derived' ? 'derived' : rappiStatus === 'partial' ? 'partial' : 'matched';
                if (rappiStatus === 'derived')
                    derivedIds = derived.filter((d) => d.type === 'comision_rappi').map((d) => d.transactionId);
            }
            else if (cls === 'tarjeta_credito') {
                status = tcStatus === 'derived' ? 'derived' : tcStatus === 'partial' ? 'partial' : 'matched';
                if (tcStatus === 'derived')
                    derivedIds = derived.filter((d) => d.type === 'retencion_tc').map((d) => d.transactionId);
            }
            else {
                status = 'ignored';
            }
            b.update(companyRef.collection(BANK_MOVEMENTS).doc(m.id), {
                classification: cls,
                reconcileStatus: status,
                ...(cls === 'rappi' ? { posGrossRappi: Math.round(posRappiGross) } : {}),
                ...(derivedIds.length > 0 ? { derivedTransactionIds: derivedIds } : {}),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
        await b.commit();
    }
    // 8. Marcar el statement como conciliado.
    await companyRef.collection(BANK_STATEMENTS).doc(statementId).set({ status: 'reconciled', reconciledAt: FieldValue.serverTimestamp() }, { merge: true });
    const partialCount = inflows.filter((m) => {
        const c = classification.get(m.id);
        return ((c === 'rappi' && rappiStatus === 'partial') ||
            (c === 'tarjeta_credito' && tcStatus === 'partial'));
    }).length;
    const summary = {
        statementId,
        periodStart,
        periodEnd,
        movements: movements.length,
        inflows: inflows.length,
        closingsCount,
        posRappiGross: Math.round(posRappiGross),
        posVentasSeen,
        bankRappiNet: Math.round(bankRappiNet),
        bankTcNet: Math.round(bankTcNet),
        sumDatafonoClosings: Math.round(sumDatafonoClosings),
        rappiCommission,
        rappiStatus,
        tcRetencion,
        tcStatus,
        derivedTransactions: derived,
        partialCount,
        ranAt: new Date().toISOString(),
    };
    // 9. Reporte de corrida (observabilidad, no lo leen los hooks).
    try {
        await companyRef
            .collection('reports')
            .doc('bank-reconcile')
            .collection('runs')
            .doc(new Date().toISOString().slice(0, 10))
            .set({ ...summary, finishedAt: Timestamp.now() }, { merge: true });
    }
    catch (err) {
        console.warn('[reconcileBankStatement] no se pudo persistir el reporte:', err);
    }
    void reportProgress(toolCallId, { label: 'Conciliación finalizada', status: 'done' });
    return summary;
});
//# sourceMappingURL=bank-reconcile.js.map