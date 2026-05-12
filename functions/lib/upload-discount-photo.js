import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './firestore.js';
import { ensureFolderPath, uploadFile, getUserDriveAuth, resolveDriveUid, driveClientId, driveClientSecret, } from './services/drive-oauth.js';
// Callable de upload de fotos de Descuentos a Drive.
// Estructura: {Company.driveDiscountsFolderId} / {YYYY} / {MesEs} / {filename}
// Nombre: "Descuento - {motivo}[ - {detalle}] - {Mes DD YYYY}.{ext}"
// La carpeta raíz es propia por empresa (distinta de driveRootFolderId, que es
// la de facturación) — el usuario la configura en Ajustes → Compañías.
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
    return s.replace(/[\\/:*?"<>|]/g, '').trim();
}
function parseDate(input) {
    if (typeof input === 'number')
        return new Date(input);
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
    const idx = fallbackName.lastIndexOf('.');
    return idx >= 0 ? fallbackName.slice(idx + 1).toLowerCase() : 'bin';
}
const SECRETS = [driveClientId, driveClientSecret];
export const uploadDiscountPhotoToDrive = onCall({ region: 'us-central1', memory: '512MiB', timeoutSeconds: 60, secrets: SECRETS }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login requerido');
    }
    const data = request.data;
    if (!data?.companyId)
        throw new HttpsError('invalid-argument', 'companyId requerido');
    if (!data.reason?.trim())
        throw new HttpsError('invalid-argument', 'reason requerido');
    if (!data.fileBase64)
        throw new HttpsError('invalid-argument', 'fileBase64 requerido');
    if (!data.mimeType)
        throw new HttpsError('invalid-argument', 'mimeType requerido');
    await assertCompanyMember(request.auth.uid, data.companyId);
    const companySnap = await db.collection('companies').doc(data.companyId).get();
    if (!companySnap.exists)
        throw new HttpsError('not-found', 'Empresa no encontrada');
    const company = companySnap.data();
    if (!company.driveDiscountsFolderId) {
        throw new HttpsError('failed-precondition', 'Esta compañía no tiene carpeta de Descuentos configurada. Ve a Ajustes → Compañías.');
    }
    const driveUid = await resolveDriveUid(data.companyId, request.auth.uid);
    const userAuth = await getUserDriveAuth(driveUid);
    if (!userAuth?.refreshToken) {
        throw new HttpsError('failed-precondition', 'El Drive de la empresa no está conectado. El propietario debe conectarlo en Ajustes → Compañías.');
    }
    const date = parseDate(data.date ?? Date.now());
    const year = String(date.getFullYear());
    const month = MESES_ES[date.getMonth()];
    const dd = String(date.getDate()).padStart(2, '0');
    const ext = extFromMime(data.mimeType, data.fileName);
    const reason = sanitizeForFileName(data.reason);
    const detail = data.detail?.trim() ? sanitizeForFileName(data.detail) : '';
    const fileName = `Descuento - ${reason}${detail ? ` - ${detail}` : ''} - ${month} ${dd} ${year}.${ext}`;
    const targetFolderId = await ensureFolderPath(driveUid, data.companyId, company.driveDiscountsFolderId, [year, month]);
    const uploaded = await uploadFile(driveUid, targetFolderId, fileName, data.mimeType, data.fileBase64);
    return {
        driveFileId: uploaded.driveFileId,
        webViewLink: uploaded.webViewLink,
        fileName: uploaded.fileName,
    };
});
//# sourceMappingURL=upload-discount-photo.js.map