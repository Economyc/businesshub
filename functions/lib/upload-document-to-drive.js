import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './firestore.js';
import { ensureFolderPath, uploadFile, validateRootFolderAccess, getServiceAccountEmail, } from './services/drive.js';
// Callable de upload de documentos (Facturas, Pagos, Compras) a Drive.
// Estructura: {Company.driveRootFolderId} / {YYYY} / {MesEs} / {filename}
// Nombre: "{Proveedor} - {docType} {docNumber} - {Mes DD YYYY}.{ext}"
const MESES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
async function assertCompanyMember(uid, companyId) {
    const snap = await db
        .collection('companies')
        .doc(companyId)
        .collection('members')
        .doc(uid)
        .get();
    if (!snap.exists) {
        throw new HttpsError('permission-denied', 'No eres miembro de esta empresa');
    }
    const m = snap.data();
    if (m.status !== 'active') {
        throw new HttpsError('permission-denied', 'Tu cuenta no está activa en esta empresa');
    }
}
function sanitizeForFileName(s) {
    // Drive tolera casi cualquier cosa, pero quitamos slashes y caracteres
    // problemáticos para mantener nombres limpios.
    return s.replace(/[\\/:*?"<>|]/g, '').trim();
}
function parseDate(input) {
    if (typeof input === 'number')
        return new Date(input);
    // Acepta YYYY-MM-DD interpretándolo como local (sin UTC shift).
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (m)
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(input);
}
function extFromMime(mime, fallbackName) {
    if (mime.includes('pdf'))
        return 'pdf';
    if (mime.includes('jpeg') || mime.includes('jpg'))
        return 'jpg';
    if (mime.includes('png'))
        return 'png';
    if (mime.includes('webp'))
        return 'webp';
    if (mime.includes('heic'))
        return 'heic';
    if (mime.includes('heif'))
        return 'heif';
    // Fallback: extraer extensión del nombre original.
    const idx = fallbackName.lastIndexOf('.');
    return idx >= 0 ? fallbackName.slice(idx + 1).toLowerCase() : 'bin';
}
export const uploadDocumentToDrive = onCall({ region: 'us-central1', memory: '512MiB', timeoutSeconds: 60 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login requerido');
    }
    const data = request.data;
    if (!data?.companyId)
        throw new HttpsError('invalid-argument', 'companyId requerido');
    if (!data.docType || !['Factura', 'Pago', 'Compra'].includes(data.docType)) {
        throw new HttpsError('invalid-argument', 'docType debe ser Factura, Pago o Compra');
    }
    if (!data.supplierName?.trim())
        throw new HttpsError('invalid-argument', 'supplierName requerido');
    if (!data.docNumber?.trim())
        throw new HttpsError('invalid-argument', 'docNumber requerido');
    if (!data.fileBase64)
        throw new HttpsError('invalid-argument', 'fileBase64 requerido');
    if (!data.mimeType)
        throw new HttpsError('invalid-argument', 'mimeType requerido');
    await assertCompanyMember(request.auth.uid, data.companyId);
    const companySnap = await db.collection('companies').doc(data.companyId).get();
    if (!companySnap.exists)
        throw new HttpsError('not-found', 'Empresa no encontrada');
    const company = companySnap.data();
    if (!company.driveRootFolderId) {
        throw new HttpsError('failed-precondition', 'La empresa no tiene Drive configurado. Pide al administrador que configure la carpeta raíz en Ajustes.');
    }
    const date = parseDate(data.date ?? Date.now());
    const year = String(date.getFullYear());
    const month = MESES_ES[date.getMonth()];
    const dd = String(date.getDate()).padStart(2, '0');
    const ext = extFromMime(data.mimeType, data.fileName);
    const supplier = sanitizeForFileName(data.supplierName);
    const docNumber = sanitizeForFileName(data.docNumber);
    const fileName = `${supplier} - ${data.docType} ${docNumber} - ${month} ${dd} ${year}.${ext}`;
    const targetFolderId = await ensureFolderPath(data.companyId, company.driveRootFolderId, [
        year,
        month,
    ]);
    const uploaded = await uploadFile(targetFolderId, fileName, data.mimeType, data.fileBase64);
    return {
        driveFileId: uploaded.driveFileId,
        webViewLink: uploaded.webViewLink,
        fileName: uploaded.fileName,
    };
});
export const validateDriveFolder = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 30 }, async (request) => {
    if (!request.auth)
        throw new HttpsError('unauthenticated', 'Login requerido');
    const data = request.data;
    if (!data?.companyId || !data?.rootFolderId) {
        throw new HttpsError('invalid-argument', 'companyId y rootFolderId requeridos');
    }
    await assertCompanyMember(request.auth.uid, data.companyId);
    const result = await validateRootFolderAccess(data.rootFolderId);
    const saEmail = await getServiceAccountEmail();
    return { ...result, serviceAccountEmail: saEmail };
});
// Callable simple para que la UI muestre el email de la SA sin necesidad de
// hacer una validación de carpeta.
export const getDriveServiceAccount = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 15 }, async (request) => {
    if (!request.auth)
        throw new HttpsError('unauthenticated', 'Login requerido');
    const email = await getServiceAccountEmail();
    return { email };
});
//# sourceMappingURL=upload-document-to-drive.js.map