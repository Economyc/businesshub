import { google } from 'googleapis';
import { Readable } from 'stream';
import { db } from '../firestore.js';
// Drive helper: autentica con la service account default de la Cloud Function
// (ADC) con scope drive.file/drive. El dueño de la empresa debe compartir su
// carpeta raíz con el email de esa SA — entonces los archivos subidos quedan
// en la carpeta del usuario y heredan los permisos de compartir.
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];
let driveClient = null;
let serviceAccountEmail = null;
async function getDrive() {
    if (driveClient)
        return driveClient;
    const auth = new google.auth.GoogleAuth({ scopes: DRIVE_SCOPES });
    // Cache también el email de la SA para mostrarlo en UI ("comparte con X").
    try {
        const creds = await auth.getCredentials();
        serviceAccountEmail = creds.client_email ?? null;
    }
    catch {
        /* noop */
    }
    driveClient = google.drive({ version: 'v3', auth });
    return driveClient;
}
export async function getServiceAccountEmail() {
    if (serviceAccountEmail)
        return serviceAccountEmail;
    await getDrive();
    return serviceAccountEmail;
}
// Caché de folder IDs por (companyId, path) en Firestore para evitar consultar
// Drive cada vez. Path se serializa como "2026/Mayo".
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
    // Busca primero — Drive permite folders con mismo nombre, así que solo
    // creamos si no encontramos uno existente bajo el parent dado.
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
    if (!created.data.id) {
        throw new Error(`No se pudo crear la carpeta "${name}" en Drive`);
    }
    return created.data.id;
}
export async function ensureFolderPath(companyId, rootFolderId, segments) {
    const drive = await getDrive();
    let parent = rootFolderId;
    const accumulatedPath = [];
    for (const seg of segments) {
        accumulatedPath.push(seg);
        const cacheKey = accumulatedPath.join('/');
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
export async function uploadFile(parentFolderId, fileName, mimeType, fileBase64) {
    const drive = await getDrive();
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
// Verifica que la SA tenga acceso de escritura al folder raíz. Útil para
// validar el setup al guardar el driveRootFolderId en settings.
export async function validateRootFolderAccess(rootFolderId) {
    try {
        const drive = await getDrive();
        const meta = await drive.files.get({
            fileId: rootFolderId,
            fields: 'id, name, mimeType, capabilities(canAddChildren)',
            supportsAllDrives: true,
        });
        if (meta.data.mimeType !== 'application/vnd.google-apps.folder') {
            return { ok: false, error: 'El ID no corresponde a una carpeta' };
        }
        if (!meta.data.capabilities?.canAddChildren) {
            return { ok: false, error: 'La service account no tiene permiso de escritura en esta carpeta' };
        }
        return { ok: true, folderName: meta.data.name ?? 'sin nombre' };
    }
    catch (err) {
        const msg = err.message ?? 'Error desconocido al validar la carpeta';
        return { ok: false, error: msg };
    }
}
//# sourceMappingURL=drive.js.map