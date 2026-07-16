import { google } from 'googleapis';
import { Readable } from 'stream';
import { defineSecret } from 'firebase-functions/params';
import { db } from '../firestore.js';
import { MESES_ES } from '../utils/doc-naming.js';
// OAuth helper para Drive.
// El usuario autoriza una vez desde Settings → "Conectar Drive". El refresh
// token resultante queda en users/{uid}.driveAuth.refreshToken. A partir de ahí
// cada upload usa ese token para llamar a la Drive API en nombre del usuario,
// así los archivos quedan en SU Drive (con su quota, no la de la SA).
//
// Para las subidas de una empresa NO se usa el uid del usuario que sube, sino
// el del "dueño de Drive" de esa empresa (resolveDriveUid). Esto permite que
// usuarios limitados (p. ej. administradores de punto de venta que sólo ven
// Cierres y Descuentos, sin acceso a Ajustes) suban archivos que aterrizan en
// el Drive del propietario sin tener que conectar nada ellos mismos.
export const driveClientId = defineSecret('DRIVE_OAUTH_CLIENT_ID');
export const driveClientSecret = defineSecret('DRIVE_OAUTH_CLIENT_SECRET');
const DRIVE_SCOPES = [
    // Acceso completo a Drive — necesario para validar carpetas que el usuario
    // creó manualmente. drive.file solo dejaría tocar archivos creados por la
    // app y bloquea la validación del folder raíz que el user nos da.
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.email',
];
/**
 * URI de callback registrada en el OAuth Client de GCP. Apunta al endpoint
 * `driveOAuthCallback` de Cloud Functions, no al frontend (porque la app
 * vive en HTTP y Google solo acepta HTTPS para redirect_uri).
 */
export function getRedirectUri() {
    return 'https://us-central1-empresas-bf.cloudfunctions.net/driveOAuthCallback';
}
export function createOAuthClient() {
    return new google.auth.OAuth2(driveClientId.value(), driveClientSecret.value(), getRedirectUri());
}
export function buildAuthUrl(state) {
    const client = createOAuthClient();
    return client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // Forzamos consent para asegurar que recibimos refresh_token aunque el usuario ya haya autorizado antes.
        scope: DRIVE_SCOPES,
        state,
    });
}
export async function exchangeCodeForTokens(code) {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
        throw new Error('No se obtuvo refresh_token. Revoca el acceso anterior y vuelve a conectar.');
    }
    client.setCredentials(tokens);
    // Recuperamos el email del usuario que autorizó.
    let email = null;
    try {
        const oauth2 = google.oauth2({ version: 'v2', auth: client });
        const info = await oauth2.userinfo.get();
        email = info.data.email ?? null;
    }
    catch {
        /* noop */
    }
    return {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token ?? '',
        expiryDate: tokens.expiry_date ?? null,
        email,
    };
}
/**
 * El token vive a nivel usuario (no por empresa). Una vez que el usuario
 * conecta su Drive, lo usa para todas las empresas a las que tiene acceso.
 * Los archivos van a la carpeta `driveRootFolderId` que la empresa tenga
 * configurada (esa sí es por-empresa).
 */
export async function saveDriveAuth(uid, data) {
    await db.collection('users').doc(uid).set({
        driveAuth: {
            refreshToken: data.refreshToken,
            email: data.email,
            connectedAt: Date.now(),
        },
    }, { merge: true });
}
export async function clearDriveAuth(uid) {
    await db.collection('users').doc(uid).set({ driveAuth: null }, { merge: true });
}
export async function getUserDriveAuth(uid) {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists)
        return null;
    const data = snap.data();
    return data.driveAuth ?? null;
}
/**
 * Error tipado: el refresh token del dueño de Drive caducó o fue revocado
 * (Google responde `invalid_grant` al renovarlo). Apps OAuth en estado
 * "Testing" expiran el refresh token a los 7 días — de ahí que esto reaparezca
 * periódicamente hasta publicar la pantalla de consentimiento.
 */
export class DriveTokenExpiredError extends Error {
    constructor() {
        super('DRIVE_TOKEN_EXPIRED');
        this.name = 'DriveTokenExpiredError';
    }
}
/**
 * Error tipado: el token es válido pero NO trae el scope de Drive. Pasa cuando
 * el usuario reconecta y no marca la casilla de permiso de Drive en la pantalla
 * de consentimiento de Google (consent granular). La subida llega autenticada
 * pero sin permiso → "Request had insufficient authentication scopes".
 */
export class DriveScopeError extends Error {
    constructor() {
        super('DRIVE_SCOPE_MISSING');
        this.name = 'DriveScopeError';
    }
}
/** Detecta el `invalid_grant` venga como venga (GaxiosError, message, code). */
export function isInvalidGrant(err) {
    const e = err;
    if (e?.response?.data?.error === 'invalid_grant')
        return true;
    if (e?.code === 'invalid_grant')
        return true;
    const msg = typeof e?.message === 'string' ? e.message : '';
    return msg.includes('invalid_grant');
}
/** Detecta el caso "token sin scope de Drive" (403 / insufficient scopes). */
export function isInsufficientScope(err) {
    const e = err;
    // Sólo el caso de SCOPE faltante, no un 403 genérico de carpeta sin permiso
    // (ese llega como `insufficientFilePermissions`, que NO se reconecta arreglando).
    const reasons = e?.response?.data?.error?.errors?.map((x) => x.reason) ?? [];
    if (reasons.includes('insufficientPermissions'))
        return true;
    const msg = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
    return msg.includes('insufficient authentication scopes');
}
/**
 * Ejecuta una operación de Drive y, si falla por token caducado/revocado,
 * limpia el `driveAuth` muerto (para que Ajustes muestre "desconectado" en vez
 * de mentir) y propaga un `DriveTokenExpiredError` que el callable traduce a un
 * mensaje accionable.
 */
async function runDrive(uid, fn) {
    try {
        return await fn();
    }
    catch (err) {
        if (isInvalidGrant(err)) {
            await clearDriveAuth(uid).catch(() => {
                /* no bloquear el error real por un fallo al limpiar */
            });
            throw new DriveTokenExpiredError();
        }
        if (isInsufficientScope(err)) {
            // El token no sirve para subir: forzamos reconexión limpia.
            await clearDriveAuth(uid).catch(() => { });
            throw new DriveScopeError();
        }
        throw err;
    }
}
/**
 * Error tipado: se agotó el presupuesto de tiempo antes de conseguir que Drive
 * respondiera. El caller lo traduce a "encolado" en vez de a un fallo duro — el
 * cron regenerará la hoja. Existe para NUNCA llegar al timeout del contenedor:
 * un 504 lo genera la infra de Cloud Run sin header CORS, y el navegador lo
 * reporta como un error de CORS que despista (bug de prod 2026-07-16).
 */
export class DriveBudgetExceededError extends Error {
    constructor() {
        super('DRIVE_BUDGET_EXCEEDED');
        this.name = 'DriveBudgetExceededError';
    }
}
const DEFAULT_ATTEMPT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 4;
/** Opciones de gaxios por request: sin retry interno (ver withDriveRetry) + timeout. */
export function driveReqOpts(opts, capMs) {
    const t = opts?.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS;
    return { retry: false, timeout: capMs ? Math.min(t, capMs) : t };
}
/**
 * ¿Merece la pena reintentar este error de Drive? Solo fallos transitorios.
 *
 * Contexto: gaxios NO reintenta nada de esto por su cuenta — su
 * `httpMethodsToRetry` por defecto es GET/HEAD/PUT/OPTIONS/DELETE, y el upload
 * de la hoja es PATCH (files.update) o POST (files.create). O sea que hasta
 * ahora un 500 de Drive moría al primer intento.
 */
export function isRetryableDriveError(err) {
    // Los errores de auth NO son transitorios: reintentarlos solo repetiría el
    // clearDriveAuth de runDrive. Cortocircuito antes que nada.
    if (isInvalidGrant(err) || isInsufficientScope(err))
        return false;
    const e = err;
    // Nuestro propio timeout por intento (gaxios aborta con AbortError).
    if (e?.name === 'AbortError')
        return true;
    const status = Number(e?.response?.status ?? e?.status ?? e?.code);
    if ([408, 429, 500, 502, 503, 504].includes(status))
        return true;
    const reasons = e?.response?.data?.error?.errors?.map((x) => x.reason) ?? [];
    if (reasons.some((r) => ['rateLimitExceeded', 'userRateLimitExceeded', 'backendError', 'internalError'].includes(r ?? ''))) {
        return true;
    }
    if (typeof e?.code === 'string' && ['ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(e.code)) {
        return true;
    }
    const msg = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
    return msg.includes('socket hang up');
}
/**
 * Reintenta `fn` con backoff exponencial ante fallos transitorios de Drive.
 *
 * `fn` DEBE ser idempotente y auto-contenida: se la envuelve entera (p. ej.
 * list → update|create), no llamada a llamada. Motivos:
 *  - Reintentar un `files.create` suelto tras un 500 puede DUPLICAR el archivo
 *    (el 500 puede llegar con el archivo ya creado). Al re-ejecutar el bloque
 *    completo, el `list` encuentra lo que dejó el intento fallido y toma `update`.
 *  - El body del upload es un `Readable`, que se consume: cada intento tiene que
 *    reconstruirlo. Metiendo el stream dentro de `fn` sale gratis.
 *
 * Va DENTRO de runDrive: los errores de auth salen intactos al primer intento y
 * runDrive los traduce como siempre.
 */
export async function withDriveRetry(fn, opts) {
    const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const attemptTimeoutMs = opts?.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS;
    const deadlineAt = opts?.deadlineAt ?? Infinity;
    for (let attempt = 1;; attempt++) {
        if (Date.now() + attemptTimeoutMs > deadlineAt)
            throw new DriveBudgetExceededError();
        try {
            return await fn();
        }
        catch (err) {
            if (attempt >= maxAttempts || !isRetryableDriveError(err))
                throw err;
            const delay = Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.random() * 250;
            // El presupuesto manda sobre el contador de intentos: si el siguiente
            // intento no cabe entero, cortar ya en vez de agotar el deadline del caller.
            if (Date.now() + delay + attemptTimeoutMs > deadlineAt)
                throw new DriveBudgetExceededError();
            console.warn(`[drive-retry] intento ${attempt}/${maxAttempts} falló (${err?.message}); reintento en ${Math.round(delay)}ms`);
            await new Promise((r) => setTimeout(r, delay));
        }
    }
}
/**
 * Resuelve qué uid de Drive usar para las operaciones de una empresa.
 *
 * 1. Si la empresa tiene `driveOwnerUid` explícito → ese (override manual).
 * 2. Si no, el primer miembro con rol `owner` y status `active`.
 * 3. Si no hay owner activo, cae al `fallbackUid` (el del request) — comportamiento legacy.
 */
export async function resolveDriveUid(companyId, fallbackUid) {
    const companyRef = db.collection('companies').doc(companyId);
    const companySnap = await companyRef.get();
    const explicit = companySnap.data()?.driveOwnerUid;
    if (explicit)
        return explicit;
    const owners = await companyRef.collection('members').where('role', '==', 'owner').limit(10).get();
    const active = owners.docs.filter((d) => d.data().status === 'active');
    // Con varios owners, el primero que devuelve la query (sin orderBy → orden NO
    // estable) puede no tener Drive conectado. Preferir el owner que SÍ tenga
    // refreshToken; caer al primer owner activo / fallback sólo si ninguno lo tiene.
    for (const d of active) {
        const auth = await getUserDriveAuth(d.id);
        if (auth?.refreshToken)
            return d.id;
    }
    if (active.length > 0)
        return active[0].id;
    return fallbackUid;
}
/**
 * Devuelve un cliente de Drive autenticado con el refresh token del usuario.
 * Lanza error si no hay token configurado.
 */
export async function getDriveForUser(uid) {
    const auth = await getUserDriveAuth(uid);
    if (!auth?.refreshToken) {
        throw new Error('DRIVE_NOT_CONNECTED');
    }
    const client = createOAuthClient();
    client.setCredentials({ refresh_token: auth.refreshToken });
    return google.drive({ version: 'v3', auth: client });
}
async function getCachedFolder(companyId, path) {
    const docId = encodeURIComponent(path);
    const snap = await db
        .collection('companies')
        .doc(companyId)
        .collection('drive-folders')
        .doc(docId)
        .get();
    if (!snap.exists)
        return null;
    const data = snap.data();
    return data.driveFolderId ?? null;
}
async function setCachedFolder(companyId, path, driveFolderId) {
    const docId = encodeURIComponent(path);
    await db
        .collection('companies')
        .doc(companyId)
        .collection('drive-folders')
        .doc(docId)
        .set({ driveFolderId, path, createdAt: Date.now() });
}
async function findFolder(drive, parentId, name, opts) {
    const escapedName = name.replace(/'/g, "\\'");
    const q = `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const list = await drive.files.list({
        q,
        fields: 'files(id, name)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    }, driveReqOpts(opts, 10_000));
    return list.data.files?.[0]?.id ?? null;
}
// Las carpetas de mes se crearon históricamente sin prefijo numérico ("Julio");
// hoy se piden como "07-Julio". Si el nombre pedido es un mes con prefijo,
// devuelve el nombre viejo para buscar/renombrar la carpeta existente en vez
// de crear una duplicada.
function legacyMonthName(name) {
    const m = /^\d{2}-(.+)$/.exec(name);
    return m && MESES_ES.includes(m[1]) ? m[1] : null;
}
async function findOrCreateFolder(drive, parentId, name, opts) {
    const existing = await findFolder(drive, parentId, name, opts);
    if (existing)
        return existing;
    const legacy = legacyMonthName(name);
    if (legacy) {
        const legacyId = await findFolder(drive, parentId, legacy, opts);
        if (legacyId) {
            await drive.files.update({
                fileId: legacyId,
                requestBody: { name },
                supportsAllDrives: true,
            }, driveReqOpts(opts));
            return legacyId;
        }
    }
    const created = await drive.files.create({
        requestBody: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
        fields: 'id',
        supportsAllDrives: true,
    }, driveReqOpts(opts));
    if (!created.data.id)
        throw new Error(`No se pudo crear la carpeta "${name}"`);
    return created.data.id;
}
export async function ensureFolderPath(uid, companyId, rootFolderId, segments, opts) {
    const drive = await getDriveForUser(uid);
    let parent = rootFolderId;
    const acc = [];
    for (const seg of segments) {
        acc.push(seg);
        // El cache key incluye el rootFolderId porque una misma empresa puede tener
        // varias carpetas raíz (facturación, descuentos, ...) y cada una su propio
        // árbol Año/Mes — sin el prefijo se cruzarían.
        const cacheKey = [rootFolderId, ...acc].join('/');
        const cached = await getCachedFolder(companyId, cacheKey);
        if (cached) {
            parent = cached;
            continue;
        }
        // findOrCreateFolder es find-then-create → re-ejecutarlo es idempotente
        // (el reintento re-hace el find y encuentra lo que dejó el intento fallido).
        const folderId = await runDrive(uid, () => withDriveRetry(() => findOrCreateFolder(drive, parent, seg, opts), opts));
        await setCachedFolder(companyId, cacheKey, folderId);
        parent = folderId;
    }
    return parent;
}
export async function uploadFile(uid, parentFolderId, fileName, mimeType, fileBase64) {
    const drive = await getDriveForUser(uid);
    const buffer = Buffer.from(fileBase64, 'base64');
    const body = Readable.from(buffer);
    const created = await runDrive(uid, () => drive.files.create({
        requestBody: { name: fileName, parents: [parentFolderId] },
        media: { mimeType, body },
        fields: 'id, webViewLink, name',
        supportsAllDrives: true,
    }));
    if (!created.data.id || !created.data.webViewLink) {
        throw new Error('Drive no retornó id/webViewLink al subir el archivo');
    }
    return {
        driveFileId: created.data.id,
        webViewLink: created.data.webViewLink,
        fileName: created.data.name ?? fileName,
    };
}
/**
 * Sube un archivo y, si ya existe uno con el mismo nombre en la carpeta, lo
 * reemplaza en vez de duplicar. Pensado para la hoja de seguimiento mensual:
 * cada mes hay un único archivo que se sobreescribe al regenerarlo.
 *
 * `convertToMimeType` hace que Drive convierta el contenido subido a un tipo
 * nativo de Google (p. ej. .xlsx → Google Sheet) usando SOLO el scope de Drive,
 * sin necesidad del scope de Sheets. Al actualizar un archivo que ya es nativo
 * de Google, subir media .xlsx reemplaza su contenido y Drive lo re-convierte.
 */
export async function uploadOrReplaceFile(uid, parentFolderId, fileName, mediaMimeType, fileBase64, convertToMimeType, opts) {
    const drive = await getDriveForUser(uid);
    const buffer = Buffer.from(fileBase64, 'base64');
    // El retry envuelve list+update/create como una unidad: así el reintento
    // re-lista (nunca duplica el archivo) y reconstruye el stream del body, que
    // el intento anterior dejó consumido. Ver withDriveRetry.
    return runDrive(uid, () => withDriveRetry(async () => {
        const escapedName = fileName.replace(/'/g, "\\'");
        const list = await drive.files.list({
            q: `'${parentFolderId}' in parents and name = '${escapedName}' and trashed = false`,
            fields: 'files(id, name)',
            pageSize: 1,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        }, driveReqOpts(opts, 10_000));
        const existing = list.data.files?.[0];
        const result = existing?.id
            ? await drive.files.update({
                fileId: existing.id,
                // Forzamos el tipo de conversión también al actualizar: si el archivo
                // previo no fuese un Sheet nativo (p. ej. un .xlsx crudo legacy),
                // esto garantiza que quede convertido igual y no se rompa la idempotencia.
                requestBody: convertToMimeType ? { mimeType: convertToMimeType } : {},
                media: { mimeType: mediaMimeType, body: Readable.from(buffer) },
                fields: 'id, webViewLink, name',
                supportsAllDrives: true,
            }, driveReqOpts(opts))
            : await drive.files.create({
                requestBody: {
                    name: fileName,
                    parents: [parentFolderId],
                    ...(convertToMimeType ? { mimeType: convertToMimeType } : {}),
                },
                media: { mimeType: mediaMimeType, body: Readable.from(buffer) },
                fields: 'id, webViewLink, name',
                supportsAllDrives: true,
            }, driveReqOpts(opts));
        if (!result.data.id || !result.data.webViewLink) {
            throw new Error('Drive no retornó id/webViewLink al guardar el archivo');
        }
        return {
            driveFileId: result.data.id,
            webViewLink: result.data.webViewLink,
            fileName: result.data.name ?? fileName,
        };
    }, opts));
}
/**
 * Borra un archivo de Drive por id. Idempotente: si el archivo ya no existe
 * (404), devuelve `notFound: true` sin lanzar — el caller lo trata como éxito.
 * Cualquier otro error de Drive sí se propaga (incluyendo invalid_grant y
 * insufficient scopes, que se traducen vía runDrive a los errores tipados).
 */
export async function deleteDriveFile(uid, fileId) {
    const drive = await getDriveForUser(uid);
    return runDrive(uid, async () => {
        try {
            await drive.files.delete({ fileId, supportsAllDrives: true });
            return { deleted: true, notFound: false };
        }
        catch (err) {
            // Detecta "no existe" cubriendo las formas en que googleapis lo devuelve:
            // code numérico, code como string ("404"), status del response, o reason
            // del payload ("notFound" en errors[0]).
            const e = err;
            const codeNum = typeof e.code === 'number' ? e.code : Number(e.code);
            const status = Number.isFinite(codeNum) ? codeNum : e.response?.status;
            const reasons = e.response?.data?.error?.errors?.map((x) => x.reason) ?? [];
            if (status === 404 || reasons.includes('notFound')) {
                return { deleted: false, notFound: true };
            }
            throw err;
        }
    });
}
/**
 * Descarga un archivo de Drive y devuelve sus bytes + mimeType. Usado para
 * recuperar la factura y el comprobante ya subidos y fusionarlos en un PDF.
 */
export async function downloadFile(uid, fileId) {
    const drive = await getDriveForUser(uid);
    return runDrive(uid, async () => {
        const meta = await drive.files.get({
            fileId,
            fields: 'mimeType',
            supportsAllDrives: true,
        });
        const media = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
        return {
            buffer: Buffer.from(media.data),
            mimeType: meta.data.mimeType ?? 'application/octet-stream',
        };
    });
}
/**
 * Mueve un archivo de Drive a otra carpeta (posiblemente de otra empresa).
 *
 *  - **Mismo dueño de Drive** (`uidFrom === uidTo`, caso típico Blue↔Blue):
 *    reparent con `addParents`/`removeParents`. Conserva `driveFileId` y
 *    `webViewLink` — el `PayableFile` no cambia.
 *  - **Dueños distintos:** no se puede reparentar entre cuentas, así que se
 *    descarga del Drive origen, se sube al destino y se borra el original.
 *    Genera un `driveFileId`/`webViewLink` NUEVOS — el caller debe persistirlos.
 *
 * Devuelve los datos (quizá nuevos) del archivo ya en destino.
 */
export async function moveDriveFile(uidFrom, uidTo, fileId, targetFolderId, fileName) {
    if (uidFrom === uidTo) {
        const drive = await getDriveForUser(uidFrom);
        return runDrive(uidFrom, async () => {
            const meta = await drive.files.get({
                fileId,
                fields: 'parents',
                supportsAllDrives: true,
            });
            const prevParents = (meta.data.parents ?? []).join(',');
            const updated = await drive.files.update({
                fileId,
                addParents: targetFolderId,
                removeParents: prevParents || undefined,
                fields: 'id, webViewLink, name',
                supportsAllDrives: true,
            });
            if (!updated.data.id)
                throw new Error('Drive no retornó id al mover el archivo');
            return {
                sameAccount: true,
                driveFileId: updated.data.id,
                webViewLink: updated.data.webViewLink ?? '',
                fileName: updated.data.name ?? fileName,
            };
        });
    }
    // Cuentas distintas: copiar bytes y borrar el original.
    const { buffer, mimeType } = await downloadFile(uidFrom, fileId);
    const uploaded = await uploadFile(uidTo, targetFolderId, fileName, mimeType, buffer.toString('base64'));
    // Borrado best-effort del original: si falla queda un huérfano recuperable,
    // pero la copia en destino ya existe y es la que referenciará la tx.
    await deleteDriveFile(uidFrom, fileId).catch((err) => {
        console.warn('[moveDriveFile] no se pudo borrar el original tras copiar', { fileId, err });
    });
    return {
        sameAccount: false,
        driveFileId: uploaded.driveFileId,
        webViewLink: uploaded.webViewLink,
        fileName: uploaded.fileName,
    };
}
export async function validateRootFolderAccess(uid, rootFolderId) {
    try {
        const drive = await getDriveForUser(uid);
        const meta = await drive.files.get({
            fileId: rootFolderId,
            fields: 'id, name, mimeType, capabilities(canAddChildren)',
            supportsAllDrives: true,
        });
        if (meta.data.mimeType !== 'application/vnd.google-apps.folder') {
            return { ok: false, error: 'El ID no corresponde a una carpeta' };
        }
        if (!meta.data.capabilities?.canAddChildren) {
            return { ok: false, error: 'No tienes permiso de escritura en esta carpeta' };
        }
        return { ok: true, folderName: meta.data.name ?? 'sin nombre' };
    }
    catch (err) {
        if (isInvalidGrant(err)) {
            await clearDriveAuth(uid).catch(() => { });
            return {
                ok: false,
                error: 'El Drive se desconectó (token caducado). El propietario debe reconectarlo en Ajustes → Compañías.',
            };
        }
        if (isInsufficientScope(err)) {
            await clearDriveAuth(uid).catch(() => { });
            return {
                ok: false,
                error: 'La conexión de Drive no concedió el permiso completo. Reconecta y marca TODAS las casillas de permiso de Google Drive.',
            };
        }
        const msg = err.message ?? 'Error desconocido al validar la carpeta';
        if (msg === 'DRIVE_NOT_CONNECTED') {
            return { ok: false, error: 'Conecta Drive primero antes de validar la carpeta.' };
        }
        return { ok: false, error: msg };
    }
}
//# sourceMappingURL=drive-oauth.js.map