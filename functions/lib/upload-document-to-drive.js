import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { db } from './firestore.js';
import { ensureFolderPath, uploadFile, validateRootFolderAccess, buildAuthUrl, exchangeCodeForTokens, saveDriveAuth, clearDriveAuth, getUserDriveAuth, resolveDriveUid, driveClientId, driveClientSecret, DriveTokenExpiredError, DriveScopeError, } from './services/drive-oauth.js';
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
export const uploadDocumentToDrive = onCall({ region: 'us-central1', memory: '512MiB', timeoutSeconds: 60, secrets: SECRETS }, async (request) => {
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
        throw new HttpsError('failed-precondition', 'La empresa no tiene Drive configurado. Ve a Ajustes y conecta Drive.');
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
    const supplier = sanitizeForFileName(data.supplierName);
    const docNumber = sanitizeForFileName(data.docNumber);
    const fileName = `${supplier} - ${data.docType} ${docNumber} - ${month} ${dd} ${year}.${ext}`;
    try {
        const targetFolderId = await ensureFolderPath(driveUid, data.companyId, company.driveRootFolderId, [year, month]);
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
export const validateDriveFolder = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, secrets: SECRETS }, async (request) => {
    if (!request.auth)
        throw new HttpsError('unauthenticated', 'Login requerido');
    const data = request.data;
    if (!data?.companyId || !data?.rootFolderId) {
        throw new HttpsError('invalid-argument', 'companyId y rootFolderId requeridos');
    }
    await assertCompanyMember(request.auth.uid, data.companyId);
    // Validamos contra el Drive que efectivamente se usará para subir (el del
    // dueño de Drive de la empresa), no el del usuario que está en Ajustes.
    const driveUid = await resolveDriveUid(data.companyId, request.auth.uid);
    const result = await validateRootFolderAccess(driveUid, data.rootFolderId);
    return result;
});
// ─── OAuth flow ──────────────────────────────────────────────────────────
export const driveAuthStart = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 15, secrets: SECRETS }, async (request) => {
    if (!request.auth)
        throw new HttpsError('unauthenticated', 'Login requerido');
    // El state lleva solo el uid + timestamp. El token resultante queda
    // asociado al usuario y se usa para todas las empresas que tenga acceso.
    const state = Buffer.from(JSON.stringify({
        uid: request.auth.uid,
        ts: Date.now(),
    })).toString('base64url');
    const url = buildAuthUrl(state);
    return { url };
});
export const driveAuthDisconnect = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 15 }, async (request) => {
    if (!request.auth)
        throw new HttpsError('unauthenticated', 'Login requerido');
    await clearDriveAuth(request.auth.uid);
    return { ok: true };
});
export const driveAuthStatus = onCall({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 15 }, async (request) => {
    if (!request.auth)
        throw new HttpsError('unauthenticated', 'Login requerido');
    const auth = await getUserDriveAuth(request.auth.uid);
    return {
        connected: !!auth?.refreshToken,
        email: auth?.email ?? null,
        connectedAt: auth?.connectedAt ?? null,
    };
});
// HTTP callback al que Google redirige tras consent. Lo abrimos en un popup
// desde el frontend — el HTML resultante notifica al opener via postMessage
// y se cierra solo.
export const driveOAuthCallback = onRequest({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, secrets: SECRETS }, async (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const code = req.query.code;
    const error = req.query.error;
    const stateRaw = req.query.state;
    function html(status, message, email) {
        return `<!doctype html>
<html><head><meta charset="utf-8"><title>Conectando Drive…</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f4f1;color:#2D2D2D}.card{max-width:380px;padding:32px;background:white;border-radius:16px;border:1px solid #e5e4e0;text-align:center}.ok{color:#1e8a4a}.err{color:#c43838}h1{font-size:18px;font-weight:500;margin:0 0 8px}p{font-size:14px;color:#6b6b6b;margin:0}</style>
</head><body><div class="card">
<h1 class="${status === 'ok' ? 'ok' : 'err'}">${status === 'ok' ? '✓ Drive conectado' : '✗ Error'}</h1>
<p>${message}</p>
${email ? `<p style="margin-top:8px"><code>${email}</code></p>` : ''}
<p style="margin-top:16px;font-size:12px">Puedes cerrar esta ventana.</p>
</div>
<script>
try {
  if (window.opener) {
    window.opener.postMessage({ type: 'drive-oauth', status: '${status}', message: ${JSON.stringify(message)}, email: ${JSON.stringify(email ?? null)} }, '*');
  }
} catch (e) {}
setTimeout(() => { try { window.close() } catch (e) {} }, 2000);
</script>
</body></html>`;
    }
    if (error) {
        res.status(400).send(html('error', `Google retornó: ${error}`));
        return;
    }
    if (!code || !stateRaw) {
        res.status(400).send(html('error', 'Faltan parámetros (code/state)'));
        return;
    }
    let parsed;
    try {
        parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf-8'));
    }
    catch {
        res.status(400).send(html('error', 'State inválido'));
        return;
    }
    // El state expira tras 10 minutos.
    if (Date.now() - parsed.ts > 10 * 60 * 1000) {
        res.status(400).send(html('error', 'El enlace expiró, intenta de nuevo'));
        return;
    }
    console.log('[driveOAuthCallback] parsed state', { uid: parsed.uid, ts: parsed.ts, uidType: typeof parsed.uid, uidLength: parsed.uid?.length });
    try {
        const tokens = await exchangeCodeForTokens(code);
        console.log('[driveOAuthCallback] tokens received', { hasRefresh: !!tokens.refreshToken, email: tokens.email });
        if (!parsed.uid || typeof parsed.uid !== 'string') {
            throw new Error(`uid del state es inválido: ${JSON.stringify(parsed)}`);
        }
        await saveDriveAuth(parsed.uid, tokens);
        console.log('[driveOAuthCallback] saved');
        res.status(200).send(html('ok', 'Drive fue conectado correctamente.', tokens.email));
    }
    catch (err) {
        console.error('[driveOAuthCallback] failed', err);
        const msg = err.message ?? 'Error desconocido';
        res.status(500).send(html('error', msg));
    }
});
//# sourceMappingURL=upload-document-to-drive.js.map