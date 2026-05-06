// Reporte incremental de progreso para tools largas (Wave 2.3).
//
// Las tools pesadas (generateExecutiveReport, executeMonthClosing,
// triggerPosReconcile) tardan 5-30s. Sin retroalimentación, el usuario solo
// ve "ejecutando…" en silencio. En vez de añadir streaming custom al
// protocolo de Vercel AI SDK, escribimos pasos incrementales a un doc
// Firestore que el cliente subscribe vía onSnapshot.
//
// Una colección dedicada `toolProgress/{toolCallId}` con un array `steps`
// (FieldValue.arrayUnion). Lecturas son ligeras (un solo doc) y la UI ya
// está suscrita por el toolCallId del part 'tool-invocation'.
//
// TTL automático recomendado: 24h vía Firestore TTL policy en consola
// (campo `updatedAt`). NO es bloqueante — los docs son efímeros.
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
const TTL_HOURS = 24;
const TTL_MS = TTL_HOURS * 60 * 60 * 1000;
/**
 * Reporta un paso de progreso para un toolCallId. Se diseñó para ser
 * fire-and-forget: el caller debe usar `void reportProgress(...)` para no
 * bloquear el camino crítico de la tool. Errores se loguean y no se
 * propagan (la tool tiene que terminar igual).
 *
 * `expireAt` se actualiza en cada write (24h en el futuro). Combinado con la
 * TTL policy de Firestore sobre el campo `expireAt`, los docs se borran
 * automáticamente 24h después de la última actividad.
 */
export async function reportProgress(toolCallId, step) {
    if (!toolCallId)
        return;
    try {
        const db = getFirestore();
        const expireAt = Timestamp.fromMillis(Date.now() + TTL_MS);
        await db.collection('toolProgress').doc(toolCallId).set({
            steps: FieldValue.arrayUnion({
                label: step.label,
                status: step.status ?? 'done',
                ts: Date.now(),
            }),
            updatedAt: FieldValue.serverTimestamp(),
            expireAt,
        }, { merge: true });
    }
    catch (e) {
        console.warn('reportProgress failed', e);
    }
}
//# sourceMappingURL=tool-progress.js.map