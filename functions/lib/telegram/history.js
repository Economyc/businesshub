// Historial de conversación por chat de Telegram.
//
// Se guarda en UN doc (telegramChats/{chatId}/state/history) como JSON string
// para esquivar las restricciones de tipos de Firestore (arrays anidados en
// tool-results) y el riesgo de superar 1MiB con estructuras raras.
//
// Reglas duras:
//  - NUNCA persistir binarios/base64: las imágenes se reemplazan por un
//    placeholder de texto antes de guardar.
//  - El truncado corta SOLO en frontera de mensaje `user`: si separa un
//    assistant(tool-call) de su tool(tool-result), Gemini rechaza el historial.
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firestore.js';
const MAX_MESSAGES = 30;
function historyRef(chatId) {
    return db
        .collection('telegramChats')
        .doc(String(chatId))
        .collection('state')
        .doc('history');
}
export async function loadHistory(chatId) {
    const snap = await historyRef(chatId).get();
    if (!snap.exists)
        return [];
    const json = snap.data().json;
    if (!json)
        return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
/** Reemplaza partes binarias (image/file) por placeholders de texto. */
function sanitizeForStorage(messages) {
    return messages.map((msg) => {
        if (!Array.isArray(msg.content))
            return msg;
        const content = msg.content.map((part) => {
            if (part.type === 'image') {
                return { type: 'text', text: '[el usuario adjuntó una imagen en este mensaje]' };
            }
            if (part.type === 'file') {
                return { type: 'text', text: '[el usuario adjuntó un documento PDF en este mensaje]' };
            }
            return part;
        });
        return { ...msg, content };
    });
}
function truncate(messages, max = MAX_MESSAGES) {
    if (messages.length <= max)
        return messages;
    let start = messages.length - max;
    while (start < messages.length && messages[start].role !== 'user')
        start++;
    if (start >= messages.length) {
        // Ningún mensaje user dentro de la ventana — conserva desde el último user
        // para no dejar tool-calls huérfanos.
        let lastUser = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                lastUser = i;
                break;
            }
        }
        start = lastUser >= 0 ? lastUser : messages.length - max;
    }
    return messages.slice(start);
}
export async function saveHistory(chatId, messages) {
    const cleaned = truncate(sanitizeForStorage(messages));
    await historyRef(chatId).set({
        json: JSON.stringify(cleaned),
        messageCount: cleaned.length,
        updatedAt: FieldValue.serverTimestamp(),
    });
}
export async function clearHistory(chatId) {
    await historyRef(chatId).delete();
}
export function chatRef(chatId) {
    return db.collection('telegramChats').doc(String(chatId));
}
export async function loadChatState(chatId) {
    const snap = await chatRef(chatId).get();
    if (!snap.exists)
        return {};
    return snap.data();
}
export async function updateChatState(chatId, patch) {
    await chatRef(chatId).set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
//# sourceMappingURL=history.js.map