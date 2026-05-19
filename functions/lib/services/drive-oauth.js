import { google } from 'googleapis';
import { Readable } from 'stream';
import { defineSecret } from 'firebase-functions/params';
import { db } from '../firestore.js';
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
    const active = owners.docs.find((d) => d.data().status === 'active');
    if (active)
        return active.id;
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
async function findOrCreateFolder(drive, parentId, name) {
    const escapedName = name.replace(/'/g, "\\'");
    const q = `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const list = await drive.files.list({
        q,
        fields: 'files(id, name)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });
    const existing = list.data.files?.[0];
    if (existing?.id)
        return existing.id;
    const created = await drive.files.create({
        requestBody: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
        fields: 'id',
        supportsAllDrives: true,
    });
    if (!created.data.id)
        throw new Error(`No se pudo crear la carpeta "${name}"`);
    return created.data.id;
}
export async function ensureFolderPath(uid, companyId, rootFolderId, segments) {
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
        const folderId = await runDrive(uid, () => findOrCreateFolder(drive, parent, seg));
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