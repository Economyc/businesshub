// Entry points del bot de Telegram:
//   telegramBot       — webhook HTTP (gen2). Seguridad en 3 capas:
//                       secret token del webhook + allowlist telegramLinks +
//                       assertCompanyMember en cada escritura.
//   telegramLinkStart — callable: genera el deep link t.me/<bot>?start=TOKEN
//                       para vincular la cuenta desde la web.
//
// Deploy SIEMPRE con gcloud (ver CLAUDE.md). maxInstances=1 + concurrency=1
// serializan los updates: sin carreras sobre el historial y costo acotado.
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { timingSafeEqual } from 'node:crypto';
import { geminiApiKey, groqApiKey, cerebrasApiKey, langfusePublicKey, langfuseSecretKey, langfuseBaseUrl, } from '../agent-chat.js';
import { driveClientId, driveClientSecret } from '../services/drive-oauth.js';
import { db } from '../firestore.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { createTelegramBot } from './bot.js';
import { createLinkToken } from './auth.js';
export const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN');
export const telegramWebhookSecret = defineSecret('TELEGRAM_WEBHOOK_SECRET');
// Bot singleton por instancia warm. bot.init() hace getMe una vez.
let botPromise = null;
function getBot() {
    if (!botPromise) {
        botPromise = (async () => {
            const bot = createTelegramBot({
                token: telegramBotToken.value(),
                geminiKey: geminiApiKey.value(),
                groqKey: groqApiKey.value(),
                cerebrasKey: cerebrasApiKey.value(),
            });
            await bot.init();
            return bot;
        })();
    }
    return botPromise;
}
function secretTokenMatches(header) {
    if (typeof header !== 'string' || !header)
        return false;
    const expected = Buffer.from(telegramWebhookSecret.value());
    const received = Buffer.from(header);
    if (expected.length !== received.length)
        return false;
    return timingSafeEqual(expected, received);
}
// El original no puede seguir vivo después del timeout de la función: pasado
// este umbral, un update aún en 'processing' significa que el proceso murió
// (OOM, timeout) sin marcar 'done' y es seguro reprocesarlo.
const PROCESSING_TIMEOUT_MS = 300_000;
function updateRef(updateId) {
    return db.collection('telegramUpdates').doc(String(updateId));
}
/**
 * Dedupe por update_id con recuperación de crashes. create() falla si el doc
 * ya existe (reintento de Telegram); en ese caso el status decide:
 *  - 'done'       → el original terminó (con o sin error reportado al chat).
 *  - 'processing' → o el original sigue corriendo (joven) o murió sin marcar
 *                   'done' (viejo, ej. OOM) y hay que reprocesar.
 */
async function claimUpdate(updateId) {
    try {
        await updateRef(updateId).create({
            status: 'processing',
            receivedAt: Timestamp.now(),
            expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
        });
        return 'new';
    }
    catch (err) {
        const code = err.code;
        if (code !== 6 && code !== 'already-exists' /* ALREADY_EXISTS */)
            throw err;
    }
    const snap = await updateRef(updateId).get();
    const data = snap.data();
    // Docs de antes de este cambio no tienen status: tratarlos como terminados.
    if (!data || data.status === 'done' || !data.status)
        return 'duplicate';
    const ageMs = Date.now() - (data.receivedAt?.toMillis() ?? 0);
    if (ageMs < PROCESSING_TIMEOUT_MS)
        return 'retry-in-flight';
    await updateRef(updateId).set({ status: 'processing', receivedAt: Timestamp.now() }, { merge: true });
    return 'retry-after-crash';
}
async function markUpdateDone(updateId) {
    await updateRef(updateId)
        .set({ status: 'done', doneAt: FieldValue.serverTimestamp() }, { merge: true })
        .catch(() => { });
}
export const telegramBot = onRequest({
    timeoutSeconds: 300,
    // 512MiB hacía OOM procesando fotos (bundle base + buffer + base64 + LLM).
    // OJO: gcloud ignora este valor — pasar --memory=1Gi en el deploy.
    memory: '1GiB',
    maxInstances: 1,
    concurrency: 1,
    secrets: [
        telegramBotToken,
        telegramWebhookSecret,
        geminiApiKey,
        groqApiKey,
        cerebrasApiKey,
        langfusePublicKey,
        langfuseSecretKey,
        langfuseBaseUrl,
        driveClientId,
        driveClientSecret,
    ],
}, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    if (!secretTokenMatches(req.header('x-telegram-bot-api-secret-token'))) {
        res.status(401).send('Unauthorized');
        return;
    }
    const update = req.body;
    if (typeof update?.update_id !== 'number') {
        res.status(400).send('Bad request');
        return;
    }
    try {
        const claim = await claimUpdate(update.update_id);
        if (claim === 'duplicate') {
            // El original ya terminó → 200 y listo.
            res.status(200).json({ ok: true, duplicate: true });
            return;
        }
        if (claim === 'retry-in-flight') {
            // El original puede seguir corriendo. 500 para que Telegram siga
            // reintentando: si el original termina, el próximo retry verá 'done';
            // si murió (OOM/timeout), pasado el umbral se reprocesa.
            res.status(500).json({ ok: false, retry: true });
            return;
        }
        if (claim === 'retry-after-crash') {
            console.warn(`[telegramBot] reprocesando update ${update.update_id} tras crash del original`);
        }
        const bot = await getBot();
        await bot.handleUpdate(update);
        await markUpdateDone(update.update_id);
        res.status(200).json({ ok: true });
    }
    catch (err) {
        console.error('[telegramBot] update failed:', err);
        // 'done' + 200: los errores que llegan aquí ya se reportaron al chat
        // (catch del handler en bot.ts); un retry de Telegram no aportaría nada.
        await markUpdateDone(update.update_id);
        res.status(200).json({ ok: false });
    }
});
// ─── Vinculación desde la web ─────────────────────────────────────────────
export const telegramLinkStart = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 15, secrets: [telegramBotToken] }, async (request) => {
    if (!request.auth)
        throw new HttpsError('unauthenticated', 'Login requerido');
    const token = await createLinkToken(request.auth.uid);
    // getMe para armar el deep link con el username real del bot.
    const meRes = await fetch(`https://api.telegram.org/bot${telegramBotToken.value()}/getMe`);
    const me = (await meRes.json());
    if (!me.ok || !me.result?.username) {
        throw new HttpsError('internal', 'No pude obtener el username del bot');
    }
    return {
        url: `https://t.me/${me.result.username}?start=${token}`,
        expiresInMinutes: 15,
    };
});
//# sourceMappingURL=index.js.map