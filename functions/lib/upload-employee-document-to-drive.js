import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './firestore.js';
import { ensureFolderPath, uploadFile, getUserDriveAuth, resolveDriveUid, driveClientId, driveClientSecret, DriveTokenExpiredError, DriveScopeError, } from './services/drive-oauth.js';
import { assertCompanyMember } from './utils/company-access.js';
import { sanitizeForFileName, extFromMime } from './utils/doc-naming.js';
// Callable de upload de documentos de empleados (RR.HH.) a Drive.
// Reutiliza el driveRootFolderId YA configurado de la empresa (el mismo de
// facturación) y auto-crea la estructura:
//   {driveRootFolderId} / Empleados / {Nombre - Cédula} / {filename}
// Nombre: "{tipo de documento} - {Nombre del empleado}.{ext}"
//
// No requiere que el usuario pegue ningún folder ID nuevo: ensureFolderPath
// busca/crea las subcarpetas por nombre.
const EMPLOYEE_SUBFOLDER = 'Empleados';
const SECRETS = [driveClientId, driveClientSecret];
export const uploadEmployeeDocumentToDrive = onCall({ region: 'us-central1', memory: '512MiB', timeoutSeconds: 60, secrets: SECRETS }, async (request) => {
    if (!request.auth)
        throw new HttpsError('unauthenticated', 'Login requerido');
    const data = request.data;
    const actorUid = request.auth.uid;
    if (!data?.companyId)
        throw new HttpsError('invalid-argument', 'companyId requerido');
    if (!data.employeeName?.trim())
        throw new HttpsError('invalid-argument', 'employeeName requerido');
    if (!data.docTypeLabel?.trim())
        throw new HttpsError('invalid-argument', 'docTypeLabel requerido');
    if (!data.fileBase64)
        throw new HttpsError('invalid-argument', 'fileBase64 requerido');
    if (!data.mimeType)
        throw new HttpsError('invalid-argument', 'mimeType requerido');
    await assertCompanyMember(actorUid, data.companyId);
    const companySnap = await db.collection('companies').doc(data.companyId).get();
    if (!companySnap.exists)
        throw new HttpsError('not-found', 'Empresa no encontrada');
    const company = companySnap.data();
    if (!company.driveRootFolderId) {
        throw new HttpsError('failed-precondition', 'La empresa no tiene Drive configurado. Ve a Ajustes y conecta Drive.');
    }
    const driveUid = await resolveDriveUid(data.companyId, actorUid);
    const userAuth = await getUserDriveAuth(driveUid);
    if (!userAuth?.refreshToken) {
        throw new HttpsError('failed-precondition', 'El Drive de la empresa no está conectado. El propietario debe conectarlo en Ajustes → Compañías.');
    }
    const employeeName = sanitizeForFileName(data.employeeName);
    const identification = sanitizeForFileName(data.identification ?? '');
    const docTypeLabel = sanitizeForFileName(data.docTypeLabel);
    const ext = extFromMime(data.mimeType, data.fileName);
    // Carpeta del empleado: "Nombre - Cédula" (o solo el nombre si no hay cédula).
    const employeeFolder = identification ? `${employeeName} - ${identification}` : employeeName;
    const fileName = `${docTypeLabel} - ${employeeName}.${ext}`;
    try {
        const targetFolderId = await ensureFolderPath(driveUid, data.companyId, company.driveRootFolderId, [
            EMPLOYEE_SUBFOLDER,
            employeeFolder,
        ]);
        const uploaded = await uploadFile(driveUid, targetFolderId, fileName, data.mimeType, data.fileBase64);
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
//# sourceMappingURL=upload-employee-document-to-drive.js.map