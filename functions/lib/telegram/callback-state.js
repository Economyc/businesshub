// Estado efímero de los flujos interactivos por botones (menús navegables).
//
// A diferencia de telegramPendingMutations (escritura transaccional, TTL 24h),
// esto es de lectura/navegación: la lista de facturas paginada o el borrador de
// un registro rápido, que no caben en los 64 bytes de callback_data de Telegram.
// El payload se serializa como JSON string (mismo motivo que en confirmations.ts
// e history.ts: Firestore rechaza ciertas estructuras anidadas).
//
// TTL corto (1h): si el usuario tappea un botón viejo, loadCallbackState devuelve
// null y el handler responde "menú expiró".
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../firestore.js';
const STATE_TTL_MS = 60 * 60 * 1000; // 1h
function stateRef(id) {
    return db.collection('telegramCallbackState').doc(id);
}
export async function saveCallbackState(data) {
    const ref = db.collection('telegramCallbackState').doc();
    await ref.set({
        chatId: data.chatId,
        uid: data.uid,
        companyId: data.companyId,
        kind: data.kind,
        payload: JSON.stringify(data.payload),
        ...(data.messageId ? { messageId: data.messageId } : {}),
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + STATE_TTL_MS),
    });
    return ref.id;
}
/**
 * Carga el estado si sigue vigente (no expirado) y pertenece a este chat.
 * Devuelve null si no existe, expiró o el chatId no coincide (defensa contra
 * callback_data de otro chat).
 */
export async function loadCallbackState(stateId, chatId) {
    const snap = await stateRef(stateId).get();
    if (!snap.exists)
        return null;
    const raw = snap.data();
    if (Number(raw.chatId) !== chatId)
        return null;
    if (raw.expiresAt && raw.expiresAt.toMillis() < Date.now())
        return null;
    let payload;
    try {
        payload = JSON.parse(String(raw.payload ?? 'null'));
    }
    catch {
        return null;
    }
    return {
        stateId,
        chatId: Number(raw.chatId),
        uid: String(raw.uid),
        companyId: String(raw.companyId),
        kind: raw.kind,
        payload,
        messageId: raw.messageId,
        status: raw.status ?? 'active',
    };
}
export async function patchCallbackState(stateId, patch) {
    const data = { updatedAt: FieldValue.serverTimestamp() };
    if (patch.payload !== undefined)
        data.payload = JSON.stringify(patch.payload);
    if (patch.messageId !== undefined)
        data.messageId = patch.messageId;
    if (patch.status !== undefined)
        data.status = patch.status;
    await stateRef(stateId).set(data, { merge: true });
}
//# sourceMappingURL=callback-state.js.map