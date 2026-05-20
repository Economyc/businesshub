import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './firestore.js';
import { ensureFolderPath, uploadOrReplaceFile, resolveDriveUid, getUserDriveAuth, driveClientId, driveClientSecret, DriveTokenExpiredError, DriveScopeError, } from './services/drive-oauth.js';
import { assertCompanyMember } from './utils/company-access.js';
import { MESES_ES } from './utils/doc-naming.js';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const SECRETS = [driveClientId, driveClientSecret];
export const saveInvoiceSheetToDrive = onCall({ region: 'us-central1', memory: '512MiB', timeoutSeconds: 120, secrets: SECRETS }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login requerido');
    }
    const data = request.data;
    if (!data?.companyId)
        throw new HttpsError('invalid-argument', 'companyId requerido');
    if (!data.fileBase64)
        throw new HttpsError('invalid-argument', 'fileBase64 requerido');
    if (!data.fileName?.trim())
        throw new HttpsError('invalid-argument', 'fileName requerido');
    if (typeof data.year !== 'number' ||
        typeof data.monthIndex !== 'number' ||
        data.monthIndex < 0 ||
        data.monthIndex > 11) {
        throw new HttpsError('invalid-argument', 'year/monthIndex inválidos');
    }
    await assertCompanyMember(request.auth.uid, data.companyId);
    const companySnap = await db.collection('companies').doc(data.companyId).get();
    if (!companySnap.exists)
        throw new HttpsError('not-found', 'Empresa no encontrada');
    const company = companySnap.data();
    if (!company.driveRootFolderId) {
        throw new HttpsError('failed-precondition', 'La empresa no tiene Drive configurado. Ve a Ajustes y conecta Drive.');
    }
    const driveUid = await resolveDriveUid(data.companyId, request.auth.uid);
    const userAuth = await getUserDriveAuth(driveUid);
    if (!userAuth?.refreshToken) {
        throw new HttpsError('failed-precondition', 'El Drive de la empresa no está conectado. El propietario debe conectarlo en Ajustes → Compañías.');
    }
    const month = MESES_ES[data.monthIndex];
    try {
        const targetFolderId = await ensureFolderPath(driveUid, data.companyId, company.driveRootFolderId, [
            String(data.year),
            month,
        ]);
        const uploaded = await uploadOrReplaceFile(driveUid, targetFolderId, data.fileName.trim(), XLSX_MIME, data.fileBase64, GOOGLE_SHEET_MIME);
        return {
            driveFileId: uploaded.driveFileId,
            webViewLink: uploaded.webViewLink,
            fileName: uploaded.fileName,
        };
    }
    catch (err) {
        if (err instanceof DriveTokenExpiredError) {
            throw new HttpsError('failed-precondition', 'El Drive de la empresa se desconectó (la sesión de Google caducó). El propietario debe reconectarlo en Ajustes → Compañías.');
        }
        if (err instanceof DriveScopeError) {
            throw new HttpsError('failed-precondition', 'Al reconectar Drive no se concedió el permiso completo. El propietario debe volver a Ajustes → Compañías, Desconectar y Conectar Drive, y marcar TODAS las casillas de permiso de Google Drive en la pantalla de Google.');
        }
        throw err;
    }
});
//# sourceMappingURL=save-invoice-sheet.js.map