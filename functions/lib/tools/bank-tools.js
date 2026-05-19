import { tool } from 'ai';
import { z } from 'zod';
import { db } from '../firestore.js';
const BANK_STATEMENTS = 'bank-statements';
const BANK_MOVEMENTS = 'bank-movements';
function tsToISO(val) {
    if (val && typeof val === 'object' && '_seconds' in val) {
        return new Date(val._seconds * 1000).toISOString().slice(0, 10);
    }
    return null;
}
export function createBankTools(companyId) {
    return {
        getBankReconcileStatus: tool({
            description: 'Lista los extractos bancarios importados de este local con su periodo, banco, conteo de movimientos y estado de conciliación (imported = sin conciliar, reconciled = ya conciliado). Útil para responder "qué extractos tengo", "cuál falta conciliar" y para obtener el statementId antes de conciliar.',
            parameters: z.object({}),
            execute: async () => {
                const snap = await db
                    .collection('companies')
                    .doc(companyId)
                    .collection(BANK_STATEMENTS)
                    .get();
                const statements = snap.docs
                    .map((d) => {
                    const s = d.data();
                    return {
                        statementId: d.id,
                        fileName: s.fileName ?? null,
                        bank: s.bank ?? null,
                        periodStart: tsToISO(s.periodStart),
                        periodEnd: tsToISO(s.periodEnd),
                        rowCount: s.rowCount ?? 0,
                        status: s.status ?? 'imported',
                    };
                })
                    .sort((a, b) => (b.periodEnd ?? '').localeCompare(a.periodEnd ?? ''));
                return {
                    count: statements.length,
                    pendingReconcile: statements.filter((s) => s.status === 'imported').length,
                    statements,
                };
            },
        }),
        getBankMovements: tool({
            description: 'Obtiene los movimientos de un extracto bancario importado, con agregados por dirección (entradas/salidas) y por estado de conciliación. Si no se pasa statementId usa el extracto más reciente. Útil para "qué entró en el extracto de mayo", "qué quedó sin conciliar".',
            parameters: z.object({
                statementId: z
                    .string()
                    .optional()
                    .describe('ID del extracto (de getBankReconcileStatus). Si se omite, usa el más reciente.'),
                onlyUnreconciled: z
                    .boolean()
                    .optional()
                    .describe('Si true, devuelve solo movimientos con reconcileStatus pending o partial.'),
                limit: z.number().int().min(1).max(200).optional().default(50),
            }),
            execute: async ({ statementId, onlyUnreconciled, limit = 50 }) => {
                const base = db.collection('companies').doc(companyId);
                let stmtId = statementId;
                if (!stmtId) {
                    const stmts = await base.collection(BANK_STATEMENTS).get();
                    if (stmts.empty)
                        return { found: false, message: 'No hay extractos importados.' };
                    stmtId = stmts.docs
                        .sort((a, b) => (tsToISO(b.data().periodEnd) ?? '').localeCompare(tsToISO(a.data().periodEnd) ?? ''))[0].id;
                }
                const movSnap = await base
                    .collection(BANK_MOVEMENTS)
                    .where('statementId', '==', stmtId)
                    .get();
                let movements = movSnap.docs.map((d) => {
                    const m = d.data();
                    return {
                        id: d.id,
                        date: tsToISO(m.date),
                        description: m.description ?? '',
                        amount: Number(m.amount) || 0,
                        direction: m.direction ?? null,
                        classification: m.classification ?? null,
                        reconcileStatus: m.reconcileStatus ?? 'pending',
                    };
                });
                if (onlyUnreconciled) {
                    movements = movements.filter((m) => m.reconcileStatus === 'pending' || m.reconcileStatus === 'partial');
                }
                const inflow = movements.filter((m) => m.direction === 'in');
                const outflow = movements.filter((m) => m.direction === 'out');
                return {
                    found: true,
                    statementId: stmtId,
                    totalMovements: movements.length,
                    totalIn: inflow.reduce((s, m) => s + m.amount, 0),
                    totalOut: outflow.reduce((s, m) => s + m.amount, 0),
                    byStatus: movements.reduce((acc, m) => {
                        acc[m.reconcileStatus] = (acc[m.reconcileStatus] ?? 0) + 1;
                        return acc;
                    }, {}),
                    movements: movements.slice(0, limit),
                };
            },
        }),
        // Client-rendered (sin execute): el cliente lo resuelve vía
        // executeMutation → callable reconcileBankStatement. Patrón triggerPosReconcile.
        reconcileBank: tool({
            description: 'Concilia un extracto bancario ya importado contra los cierres de caja y la venta Rappi del POS, y deriva automáticamente la comisión de Rappi y la retención del datáfono como GASTOS (nunca crea ingresos). Requiere confirmación del usuario. Si no se pasa statementId concilia el extracto importado más reciente. Pide primero getBankReconcileStatus si el usuario menciona un periodo/banco específico.',
            parameters: z.object({
                statementId: z
                    .string()
                    .optional()
                    .describe('ID del extracto a conciliar (de getBankReconcileStatus). Opcional.'),
            }),
        }),
    };
}
//# sourceMappingURL=bank-tools.js.map