import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { db } from './firestore.js'
import {
  ensureFolderPath,
  uploadFile,
  validateRootFolderAccess,
  buildAuthUrl,
  exchangeCodeForTokens,
  saveDriveAuth,
  clearDriveAuth,
  getUserDriveAuth,
  resolveDriveUid,
  driveClientId,
  driveClientSecret,
  DriveTokenExpiredError,
  DriveScopeError,
} from './services/drive-oauth.js'
import { assertCompanyMember } from './utils/company-access.js'
import { MESES_ES, monthFolderName, sanitizeForFileName, parseDate, extFromMime, SUBFOLDER_LOOSE, looseSubfolderFor, type DocType } from './utils/doc-naming.js'

// Callable de upload de documentos (Facturas, Pagos, Compras) a Drive.
// Estructura: {Company.driveRootFolderId} / {YYYY} / {MesEs} / {filename}
// Nombre: "{Proveedor} - {docType} {docNumber} - {Mes DD YYYY}.{ext}"

export interface UploadInput {
  companyId: string
  docType: DocType
  supplierName: string
  docNumber: string
  date: string | number
  fileBase64: string
  fileName: string
  mimeType: string
}

const SECRETS = [driveClientId, driveClientSecret]

// Cuerpo compartido del upload. Lo usan el callable (web) y el bot de
// Telegram (server-side, sin request.auth — el uid viene del link verificado).
export async function uploadCompanyDocument(
  actorUid: string,
  data: UploadInput,
): Promise<{ driveFileId: string; webViewLink: string; fileName: string }> {
  if (!data?.companyId) throw new HttpsError('invalid-argument', 'companyId requerido')
  if (!data.docType || !['Factura', 'Pago', 'Compra', 'Traslado'].includes(data.docType)) {
    throw new HttpsError('invalid-argument', 'docType debe ser Factura, Pago, Compra o Traslado')
  }
  if (!data.supplierName?.trim()) throw new HttpsError('invalid-argument', 'supplierName requerido')
  if (!data.docNumber?.trim()) throw new HttpsError('invalid-argument', 'docNumber requerido')
  if (!data.fileBase64) throw new HttpsError('invalid-argument', 'fileBase64 requerido')
  if (!data.mimeType) throw new HttpsError('invalid-argument', 'mimeType requerido')

  await assertCompanyMember(actorUid, data.companyId)

  const companySnap = await db.collection('companies').doc(data.companyId).get()
  if (!companySnap.exists) throw new HttpsError('not-found', 'Empresa no encontrada')
  const company = companySnap.data() as { name?: string; driveRootFolderId?: string }
  if (!company.driveRootFolderId) {
    throw new HttpsError(
      'failed-precondition',
      'La empresa no tiene Drive configurado. Ve a Ajustes y conecta Drive.',
    )
  }

  const driveUid = await resolveDriveUid(data.companyId, actorUid)
  const userAuth = await getUserDriveAuth(driveUid)
  if (!userAuth?.refreshToken) {
    throw new HttpsError(
      'failed-precondition',
      'El Drive de la empresa no está conectado. El propietario debe conectarlo en Ajustes → Compañías.',
    )
  }

  const date = parseDate(data.date ?? Date.now())
  const year = String(date.getFullYear())
  const month = MESES_ES[date.getMonth()]
  const dd = String(date.getDate()).padStart(2, '0')
  const ext = extFromMime(data.mimeType, data.fileName)

  const supplier = sanitizeForFileName(data.supplierName)
  const docNumber = sanitizeForFileName(data.docNumber)
  const fileName = `${supplier} - ${data.docType} ${docNumber} - ${month} ${dd} ${year}.${ext}`

  try {
    const looseSub = looseSubfolderFor(data.docType)
    const targetFolderId = await ensureFolderPath(driveUid, data.companyId, company.driveRootFolderId, [year, monthFolderName(date.getMonth()), SUBFOLDER_LOOSE, looseSub])
    const uploaded = await uploadFile(driveUid, targetFolderId, fileName, data.mimeType, data.fileBase64)

    return {
      driveFileId: uploaded.driveFileId,
      webViewLink: uploaded.webViewLink,
      fileName: uploaded.fileName,
    }
  } catch (err) {
    if (err instanceof DriveTokenExpiredError) {
      throw new HttpsError(
        'failed-precondition',
        'El Drive de la empresa se desconectó (la sesión de Google caducó). El propietario debe reconectarlo en Ajustes → Compañías.',
      )
    }
    if (err instanceof DriveScopeError) {
      throw new HttpsError(
        'failed-precondition',
        'Al reconectar Drive no se concedió el permiso completo. El propietario debe volver a Ajustes → Compañías, Desconectar y Conectar Drive, y marcar TODAS las casillas de permiso de Google Drive en la pantalla de Google.',
      )
    }
    throw err
  }
}

export const uploadDocumentToDrive = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 60, secrets: SECRETS },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login requerido')
    }
    return uploadCompanyDocument(request.auth.uid, request.data as UploadInput)
  },
)

interface ValidateInput {
  companyId: string
  rootFolderId: string
}

export const validateDriveFolder = onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, secrets: SECRETS },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login requerido')
    const data = request.data as ValidateInput
    if (!data?.companyId || !data?.rootFolderId) {
      throw new HttpsError('invalid-argument', 'companyId y rootFolderId requeridos')
    }
    await assertCompanyMember(request.auth.uid, data.companyId)
    // Validamos contra el Drive que efectivamente se usará para subir (el del
    // dueño de Drive de la empresa), no el del usuario que está en Ajustes.
    const driveUid = await resolveDriveUid(data.companyId, request.auth.uid)
    const result = await validateRootFolderAccess(driveUid, data.rootFolderId)
    return result
  },
)

// ─── OAuth flow ──────────────────────────────────────────────────────────

export const driveAuthStart = onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 15, secrets: SECRETS },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login requerido')
    // El state lleva solo el uid + timestamp. El token resultante queda
    // asociado al usuario y se usa para todas las empresas que tenga acceso.
    const state = Buffer.from(JSON.stringify({
      uid: request.auth.uid,
      ts: Date.now(),
    })).toString('base64url')
    const url = buildAuthUrl(state)
    return { url }
  },
)

export const driveAuthDisconnect = onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 15 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login requerido')
    await clearDriveAuth(request.auth.uid)
    return { ok: true }
  },
)

export const driveAuthStatus = onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 15 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login requerido')
    const auth = await getUserDriveAuth(request.auth.uid)
    return {
      connected: !!auth?.refreshToken,
      email: auth?.email ?? null,
      connectedAt: auth?.connectedAt ?? null,
    }
  },
)

// HTTP callback al que Google redirige tras consent. Lo abrimos en un popup
// desde el frontend — el HTML resultante notifica al opener via postMessage
// y se cierra solo.
export const driveOAuthCallback = onRequest(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, secrets: SECRETS },
  async (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    const code = req.query.code as string | undefined
    const error = req.query.error as string | undefined
    const stateRaw = req.query.state as string | undefined

    function html(status: 'ok' | 'error', message: string, email?: string | null) {
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
</body></html>`
    }

    if (error) {
      res.status(400).send(html('error', `Google retornó: ${error}`))
      return
    }
    if (!code || !stateRaw) {
      res.status(400).send(html('error', 'Faltan parámetros (code/state)'))
      return
    }

    let parsed: { uid: string; ts: number }
    try {
      parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf-8'))
    } catch {
      res.status(400).send(html('error', 'State inválido'))
      return
    }

    // El state expira tras 10 minutos.
    if (Date.now() - parsed.ts > 10 * 60 * 1000) {
      res.status(400).send(html('error', 'El enlace expiró, intenta de nuevo'))
      return
    }

    console.log('[driveOAuthCallback] parsed state', { uid: parsed.uid, ts: parsed.ts, uidType: typeof parsed.uid, uidLength: parsed.uid?.length })

    try {
      const tokens = await exchangeCodeForTokens(code)
      console.log('[driveOAuthCallback] tokens received', { hasRefresh: !!tokens.refreshToken, email: tokens.email })
      if (!parsed.uid || typeof parsed.uid !== 'string') {
        throw new Error(`uid del state es inválido: ${JSON.stringify(parsed)}`)
      }
      await saveDriveAuth(parsed.uid, tokens)
      console.log('[driveOAuthCallback] saved')
      res.status(200).send(html('ok', 'Drive fue conectado correctamente.', tokens.email))
    } catch (err) {
      console.error('[driveOAuthCallback] failed', err)
      const msg = (err as Error).message ?? 'Error desconocido'
      res.status(500).send(html('error', msg))
    }
  },
)
