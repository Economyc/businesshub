import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './firestore.js';
import { ensureFolderPath, uploadFile, downloadFile, resolveDriveUid, getUserDriveAuth, driveClientId, driveClientSecret, DriveTokenExpiredError, DriveScopeError, } from './services/drive-oauth.js';
import { assertCompanyMember } from './utils/company-access.js';
import { buildDocLocation, parseDate, SUBFOLDER_CONSOLIDATED } from './utils/doc-naming.js';
import { buildCombinedPdf } from './utils/build-combined-pdf.js';
const SECRETS = [driveClientId, driveClientSecret];
export const combineInvoicePaymentToDrive = onCall({ region: 'us-central1', memory: '1GiB', timeoutSeconds: 120, secrets: SECRETS }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login requerido');
    }
    const data = request.data;
    if (!data?.companyId)
        throw new HttpsError('invalid-argument', 'companyId requerido');
    if (!data.sourceFileId)
        throw new HttpsError('invalid-argument', 'sourceFileId requerido');
    if (!data.proofFileId)
        throw new HttpsError('invalid-argument', 'proofFileId requerido');
    if (!data.supplierName?.trim())
        throw new HttpsError('invalid-argument', 'supplierName requerido');
    if (!data.docNumber?.trim())
        throw new HttpsError('invalid-argument', 'docNumber requerido');
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
    const date = parseDate(data.date ?? Date.now());
    const { year, month, baseName } = buildDocLocation(data.supplierName, 'Factura+Pago', data.docNumber, date);
    const fileName = `${baseName}.pdf`;
    try {
        // Factura primero, comprobante después.
        const [source, proof] = await Promise.all([
            downloadFile(driveUid, data.sourceFileId),
            downloadFile(driveUid, data.proofFileId),
        ]);
        const pdf = await buildCombinedPdf([source, proof]);
        const pdfBase64 = pdf.toString('base64');
        const targetFolderId = await ensureFolderPath(driveUid, data.companyId, company.driveRootFolderId, [year, month, SUBFOLDER_CONSOLIDATED]);
        const uploaded = await uploadFile(driveUid, targetFolderId, fileName, 'application/pdf', pdfBase64);
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
//# sourceMappingURL=combine-invoice-payment.js.map