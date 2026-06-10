// Confirmaciones de escritura: equivalente Telegram del ConfirmationCard web.
// La mutación pendiente vive en telegramPendingMutations/{id}; los botones
// llevan callback_data "cf:<id>" / "cx:<id>" (límite 64 bytes de Telegram).
// La transición pending → executing es transaccional: es la barrera contra
// doble tap y callbacks reenviados.
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../firestore.js';
import { formatCop } from './format.js';
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
function pendingRef(id) {
    return db.collection('telegramPendingMutations').doc(id);
}
export async function savePendingMutation(data) {
    const ref = db.collection('telegramPendingMutations').doc();
    await ref.set({
        ...data,
        // args como JSON string: pueden traer estructuras que Firestore rechaza.
        args: JSON.stringify(data.args),
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + PENDING_TTL_MS),
    });
    return ref.id;
}
export async function setPendingMessageId(id, messageId) {
    await pendingRef(id).update({ telegramMessageId: messageId });
}
/** Reclama la mutación (pending → executing) de forma transaccional. */
export async function claimPendingMutation(id) {
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(pendingRef(id));
        if (!snap.exists)
            return { ok: false, reason: 'not_found' };
        const raw = snap.data();
        if (raw.status !== 'pending') {
            return { ok: false, reason: 'already_processed' };
        }
        if (raw.expiresAt && raw.expiresAt.toMillis() < Date.now()) {
            tx.update(pendingRef(id), { status: 'expired' });
            return { ok: false, reason: 'already_processed' };
        }
        tx.update(pendingRef(id), { status: 'executing', claimedAt: FieldValue.serverTimestamp() });
        let args = {};
        try {
            args = JSON.parse(String(raw.args ?? '{}'));
        }
        catch {
            /* args corruptos → mutación con args vacíos fallará con mensaje claro */
        }
        return {
            ok: true,
            mutation: {
                chatId: Number(raw.chatId),
                uid: String(raw.uid),
                companyId: String(raw.companyId),
                toolName: String(raw.toolName),
                toolCallId: String(raw.toolCallId),
                args,
                telegramFileId: raw.telegramFileId ?? null,
                telegramFileMime: raw.telegramFileMime ?? null,
                telegramFileName: raw.telegramFileName ?? null,
                status: 'executing',
                telegramMessageId: raw.telegramMessageId,
            },
        };
    });
}
export async function finalizePendingMutation(id, status, resultId) {
    await pendingRef(id).update({
        status,
        ...(resultId ? { resultId } : {}),
        finishedAt: FieldValue.serverTimestamp(),
    });
}
export async function markPendingCancelled(id) {
    await pendingRef(id).update({ status: 'cancelled', finishedAt: FieldValue.serverTimestamp() });
}
// ─── Texto del card de confirmación ──────────────────────────────────────
const str = (v) => (v == null ? '' : String(v));
export function buildConfirmationText(toolName, args, companyLabel, hasFile) {
    switch (toolName) {
        case 'createTransaction': {
            const isIncome = args.type === 'income';
            const isPending = (args.status ?? 'paid') === 'pending';
            const kind = isIncome
                ? isPending
                    ? '💰 Crear cuenta por cobrar'
                    : '💰 Crear ingreso'
                : isPending
                    ? '🧾 Crear cuenta por pagar'
                    : '🧾 Crear gasto';
            const lines = [
                `${kind} en ${companyLabel}`,
                `Concepto: ${str(args.concept)}`,
                `Monto: ${formatCop(Number(args.amount))}`,
                `Categoría: ${str(args.category)} — Fecha: ${str(args.date)}`,
            ];
            if (args.payeeName) {
                lines.push(`${isIncome ? 'Nos debe' : 'Le debemos a'}: ${str(args.payeeName)}`);
            }
            lines.push(`Estado: ${isPending ? 'Pendiente' : 'Pagada'}`);
            if (args.notes)
                lines.push(`Notas: ${str(args.notes)}`);
            return lines.join('\n');
        }
        case 'createPayableDocument': {
            const isInvoice = args.documentKind === 'invoice';
            const lines = [
                `${isInvoice ? '🧾 Crear factura (CxP)' : '🛒 Registrar compra al contado'} en ${companyLabel}`,
                `Proveedor: ${str(args.supplierName)}${args.customSupplier === true ? ' (ocasional)' : ''}`,
                `N°: ${str(args.docNumber)} — Fecha: ${str(args.date)}`,
                `Monto: ${formatCop(Number(args.amount))}`,
                `Categoría: ${str(args.category)}`,
            ];
            if (isInvoice && args.priority === 'immediate')
                lines.push('Prioridad: 🔴 URGENTE');
            if (args.notes)
                lines.push(`Notas: ${str(args.notes)}`);
            lines.push(hasFile ? 'Archivo: adjunto → se sube a Drive' : '⚠️ Sin archivo adjunto');
            return lines.join('\n');
        }
        case 'quickMarkInvoiceAsPaid': {
            const lines = [
                `✅ Marcar factura como pagada en ${companyLabel}`,
                `Factura: ${str(args.concept)}`,
                `Monto: ${formatCop(Number(args.amount))}`,
            ];
            if (args.supplierName)
                lines.push(`Proveedor: ${str(args.supplierName)}`);
            lines.push(`Fecha de pago: ${str(args.paidDate) || 'hoy'}`);
            lines.push('Sin comprobante adjunto');
            return lines.join('\n');
        }
        case 'markInvoiceAsPaid': {
            return [
                `✅ Cruzar pago de factura en ${companyLabel}`,
                `Proveedor: ${str(args.supplierName)}`,
                `Factura N°: ${str(args.docNumber)}`,
                `Monto: ${formatCop(Number(args.amount))}`,
                `Fecha de pago: ${str(args.paidDate)}`,
                hasFile ? 'Comprobante: adjunto → se archiva en Drive' : '⚠️ Sin comprobante adjunto',
            ].join('\n');
        }
        default:
            return `⚙️ ${toolName} en ${companyLabel}\n${JSON.stringify(args, null, 2).slice(0, 800)}`;
    }
}
//# sourceMappingURL=confirmations.js.map