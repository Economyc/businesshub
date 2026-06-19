// Borrado en cascada de un traslado (Ecore): doc en Firestore + comprobante en
// Drive + regeneración inmediata de la hoja de traslados del mes.
//
// Espejo reducido de delete-transaction.ts. Los traslados viven en
// companies/{companyId}/transfers, tienen un único adjunto opcional (proof) y su
// propia hoja ("Seguimiento traslados"), anclada por `date` en hora Bogotá.
//
// Orden (igual que delete-transaction):
//  1. Validar auth + membresía + existencia (idempotente: alreadyDeleted=true).
//  2. Si hay adjunto, validar Drive conectado ANTES de tocar Firestore.
//  3. Borrar el doc en Firestore PRIMERO (lo más barato/seguro).
//  4. Borrar el archivo en Drive (best-effort).
//  5. Regenerar la hoja de traslados del mes (best-effort → sheetWarning si falla).
//     NO bajamos dirty del sheet-job: la colección sheet-jobs/{ym} es compartida
//     con la hoja de facturas; dejamos que el cron reconcilie (idempotente).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './firestore.js';
import { resolveDriveUid, getUserDriveAuth, deleteDriveFile, driveClientId, driveClientSecret, DriveTokenExpiredError, DriveScopeError, } from './services/drive-oauth.js';
import { assertCompanyMember } from './utils/company-access.js';
import { regenerateTransferSheet } from './invoice-sheet/regenerate-transfers.js';
import { bogotaParts } from './invoice-sheet/month.js';
const SECRETS = [driveClientId, driveClientSecret];
// Mes contable del traslado: anclado a `date` en hora Bogotá.
function monthForTransfer(tr) {
    try {
        const d = tr.date?.toDate?.();
        if (!d)
            return null;
        return bogotaParts(d);
    }
    catch {
        return null;
    }
}
export const deleteTransferWithAttachments = onCall({ region: 'us-central1', memory: '512MiB', timeoutSeconds: 300, secrets: SECRETS }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login requerido');
    }
    const data = request.data;
    const companyId = typeof data?.companyId === 'string' ? data.companyId.trim() : '';
    const transferId = typeof data?.transferId === 'string' ? data.transferId.trim() : '';
    if (!companyId)
        throw new HttpsError('invalid-argument', 'companyId requerido');
    if (!transferId)
        throw new HttpsError('invalid-argument', 'transferId requerido');
    await assertCompanyMember(request.auth.uid, companyId);
    console.log('[deleteTransferWithAttachments] start', {
        companyId,
        transferId,
        uid: request.auth.uid,
    });
    const trRef = db
        .collection('companies')
        .doc(companyId)
        .collection('transfers')
        .doc(transferId);
    const snap = await trRef.get();
    // Idempotencia: si ya no existe (reintento, doble click), éxito sin error.
    if (!snap.exists) {
        console.log('[deleteTransferWithAttachments] already deleted', { companyId, transferId });
        return {
            deletedFiles: 0,
            attemptedFiles: 0,
            monthRegenerated: null,
            sheetWarning: null,
            alreadyDeleted: true,
            driveErrors: [],
        };
    }
    const tr = snap.data();
    // Único adjunto posible: el comprobante del traslado.
    const fileIds = Array.from(new Set([tr.proof?.driveFileId].filter((id) => typeof id === 'string' && id.length > 0)));
    // Si hay adjunto, validar Drive ANTES de tocar Firestore — un Drive
    // desconectado debe abortar limpio, no dejar el doc borrado con el archivo vivo.
    let driveUid = null;
    if (fileIds.length > 0) {
        driveUid = await resolveDriveUid(companyId, request.auth.uid);
        const userAuth = await getUserDriveAuth(driveUid);
        if (!userAuth?.refreshToken) {
            throw new HttpsError('failed-precondition', 'El Drive de la empresa no está conectado. El propietario debe reconectarlo en Ajustes → Compañías antes de eliminar traslados con comprobante.');
        }
    }
    const monthToRegen = monthForTransfer(tr);
    // 1) Firestore primero. Si falla, nada se tocó.
    await trRef.delete();
    // 2) Drive después (best-effort). Recolectamos errores para devolverlos al
    // cliente sin abortar — el traslado ya está borrado en la app.
    const driveErrors = [];
    let deletedFiles = 0;
    if (driveUid && fileIds.length > 0) {
        for (const fileId of fileIds) {
            try {
                const r = await deleteDriveFile(driveUid, fileId);
                if (r.deleted || r.notFound)
                    deletedFiles++;
            }
            catch (err) {
                if (err instanceof DriveTokenExpiredError) {
                    driveErrors.push('Drive se desconectó (sesión Google caducada). El propietario debe reconectarlo. El traslado se eliminó, pero el archivo quedó en Drive.');
                    break;
                }
                if (err instanceof DriveScopeError) {
                    driveErrors.push('La conexión de Drive no tiene el permiso completo. Reconecta marcando TODAS las casillas. El traslado se eliminó, pero el archivo quedó en Drive.');
                    break;
                }
                console.error('[deleteTransferWithAttachments] error borrando archivo en Drive', { fileId, err });
                driveErrors.push(`No se pudo eliminar un archivo en Drive (id ${fileId}).`);
            }
        }
    }
    // 3) Regeneración inmediata de la hoja de traslados. NO bajamos dirty del
    // sheet-job (compartido con la hoja de facturas) — el cron reconcilia.
    let monthRegenerated = null;
    let sheetWarning = null;
    if (monthToRegen) {
        try {
            const result = await regenerateTransferSheet(companyId, monthToRegen.year, monthToRegen.monthIndex);
            if ('skipped' in result) {
                if (result.reason === 'drive-not-connected') {
                    sheetWarning = 'No se pudo actualizar la hoja de traslados (Drive desconectado). El cron la regenerará automáticamente cuando se reconecte.';
                }
                // 'no-transfers' (mes quedó vacío) y otros skips no son error accionable.
            }
            else {
                monthRegenerated = monthToRegen;
            }
        }
        catch (err) {
            if (err instanceof DriveTokenExpiredError || err instanceof DriveScopeError) {
                sheetWarning = 'No se pudo actualizar la hoja de traslados (Drive desconectado o sin permisos). Reconectá Drive — el cron la regenerará automáticamente.';
            }
            else {
                sheetWarning = 'La hoja de traslados se actualizará en los próximos minutos.';
                console.warn('[deleteTransferWithAttachments] regenerateTransferSheet falló — el cron lo retomará', err);
            }
        }
    }
    console.log('[deleteTransferWithAttachments] done', {
        companyId,
        transferId,
        deletedFiles,
        attemptedFiles: fileIds.length,
        monthRegenerated,
        driveErrorsCount: driveErrors.length,
        sheetWarning,
    });
    return {
        deletedFiles,
        attemptedFiles: fileIds.length,
        monthRegenerated,
        sheetWarning,
        alreadyDeleted: false,
        driveErrors,
    };
});
//# sourceMappingURL=delete-transfer.js.map