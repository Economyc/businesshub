import { google } from 'googleapis';
import { Readable } from 'stream';
import { defineSecret } from 'firebase-functions/params';
import { db } from '../firestore.js';
// OAuth helper para Drive por empresa.
// El usuario autoriza una vez desde Settings → "Conectar Drive". El refresh
// token resultante queda en companies/{id}.driveAuth.refreshToken. A partir
// de ahí cada upload usa ese token para llamar a la Drive API en nombre del
// usuario, así los archivos quedan en SU Drive (con su quota, no la de la SA).
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
export async function saveDriveAuth(companyId, data) {
    await db.collection('companies').doc(companyId).set({
        driveAuth: {
            refreshToken: data.refreshToken,
            email: data.email,
            connectedAt: Date.now(),
        },
    }, { merge: true });
}
export async function clearDriveAuth(companyId) {
    await db.collection('companies').doc(companyId).set({ driveAuth: null }, { merge: true });
}
export async function getCompanyDriveAuth(companyId) {
    const snap = await db.collection('companies').doc(companyId).get();
    if (!snap.exists)
        return null;
    const data = snap.data();
    return data.driveAuth ?? null;
}
/**
 * Devuelve un cliente de Drive autenticado con el refresh token de la
 * empresa. Lanza error si no hay token configurado.
 */
export async function getDriveForCompany(companyId) {
    const auth = await getCompanyDriveAuth(companyId);
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
export async function ensureFolderPath(companyId, rootFolderId, segments) {
    const drive = await getDriveForCompany(companyId);
    let parent = rootFolderId;
    const acc = [];
    for (const seg of segments) {
        acc.push(seg);
        const cacheKey = acc.join('/');
        const cached = await getCachedFolder(companyId, cacheKey);
        if (cached) {
            parent = cached;
            continue;
        }
        const folderId = await findOrCreateFolder(drive, parent, seg);
        await setCachedFolder(companyId, cacheKey, folderId);
        parent = folderId;
    }
    return parent;
}
export async function uploadFile(companyId, parentFolderId, fileName, mimeType, fileBase64) {
    const drive = await getDriveForCompany(companyId);
    const buffer = Buffer.from(fileBase64, 'base64');
    const body = Readable.from(buffer);
    const created = await drive.files.create({
        requestBody: { name: fileName, parents: [parentFolderId] },
        media: { mimeType, body },
        fields: 'id, webViewLink, name',
        supportsAllDrives: true,
    });
    if (!created.data.id || !created.data.webViewLink) {
        throw new Error('Drive no retornó id/webViewLink al subir el archivo');
    }
    return {
        driveFileId: created.data.id,
        webViewLink: created.data.webViewLink,
        fileName: created.data.name ?? fileName,
    };
}
export async function validateRootFolderAccess(companyId, rootFolderId) {
    try {
        const drive = await getDriveForCompany(companyId);
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
        const msg = err.message ?? 'Error desconocido al validar la carpeta';
        if (msg === 'DRIVE_NOT_CONNECTED') {
            return { ok: false, error: 'Conecta Drive primero antes de validar la carpeta.' };
        }
        return { ok: false, error: msg };
    }
}
//# sourceMappingURL=drive-oauth.js.map