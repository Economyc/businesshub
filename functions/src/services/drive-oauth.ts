import { google, drive_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { Readable } from 'stream'
import { defineSecret } from 'firebase-functions/params'
import { db } from '../firestore.js'
import { MESES_ES } from '../utils/doc-naming.js'

// OAuth helper para Drive.
// El usuario autoriza una vez desde Settings → "Conectar Drive". El refresh
// token resultante queda en users/{uid}.driveAuth.refreshToken. A partir de ahí
// cada upload usa ese token para llamar a la Drive API en nombre del usuario,
// así los archivos quedan en SU Drive (con su quota, no la de la SA).
//
// Para las subidas de una empresa NO se usa el uid del usuario que sube, sino
// el del "dueño de Drive" de esa empresa (resolveDriveUid). Esto permite que
// usuarios limitados (p. ej. administradores de punto de venta que sólo ven
// Cierres y Descuentos, sin acceso a Ajustes) suban archivos que aterrizan en
// el Drive del propietario sin tener que conectar nada ellos mismos.

export const driveClientId = defineSecret('DRIVE_OAUTH_CLIENT_ID')
export const driveClientSecret = defineSecret('DRIVE_OAUTH_CLIENT_SECRET')

const DRIVE_SCOPES = [
  // Acceso completo a Drive — necesario para validar carpetas que el usuario
  // creó manualmente. drive.file solo dejaría tocar archivos creados por la
  // app y bloquea la validación del folder raíz que el user nos da.
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
]

/**
 * URI de callback registrada en el OAuth Client de GCP. Apunta al endpoint
 * `driveOAuthCallback` de Cloud Functions, no al frontend (porque la app
 * vive en HTTP y Google solo acepta HTTPS para redirect_uri).
 */
export function getRedirectUri(): string {
  return 'https://us-central1-empresas-bf.cloudfunctions.net/driveOAuthCallback'
}

export function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    driveClientId.value(),
    driveClientSecret.value(),
    getRedirectUri(),
  )
}

export function buildAuthUrl(state: string): string {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Forzamos consent para asegurar que recibimos refresh_token aunque el usuario ya haya autorizado antes.
    scope: DRIVE_SCOPES,
    state,
  })
}

export interface ExchangeResult {
  refreshToken: string
  accessToken: string
  expiryDate: number | null
  email: string | null
}

export async function exchangeCodeForTokens(code: string): Promise<ExchangeResult> {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error('No se obtuvo refresh_token. Revoca el acceso anterior y vuelve a conectar.')
  }
  client.setCredentials(tokens)
  // Recuperamos el email del usuario que autorizó.
  let email: string | null = null
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const info = await oauth2.userinfo.get()
    email = info.data.email ?? null
  } catch {
    /* noop */
  }
  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token ?? '',
    expiryDate: tokens.expiry_date ?? null,
    email,
  }
}

interface UserDriveAuth {
  refreshToken: string
  email: string | null
  connectedAt: number
}

/**
 * El token vive a nivel usuario (no por empresa). Una vez que el usuario
 * conecta su Drive, lo usa para todas las empresas a las que tiene acceso.
 * Los archivos van a la carpeta `driveRootFolderId` que la empresa tenga
 * configurada (esa sí es por-empresa).
 */
export async function saveDriveAuth(uid: string, data: ExchangeResult): Promise<void> {
  await db.collection('users').doc(uid).set(
    {
      driveAuth: {
        refreshToken: data.refreshToken,
        email: data.email,
        connectedAt: Date.now(),
      } as UserDriveAuth,
    },
    { merge: true },
  )
}

export async function clearDriveAuth(uid: string): Promise<void> {
  await db.collection('users').doc(uid).set(
    { driveAuth: null },
    { merge: true },
  )
}

export async function getUserDriveAuth(uid: string): Promise<UserDriveAuth | null> {
  const snap = await db.collection('users').doc(uid).get()
  if (!snap.exists) return null
  const data = snap.data() as { driveAuth?: UserDriveAuth | null }
  return data.driveAuth ?? null
}

/**
 * Error tipado: el refresh token del dueño de Drive caducó o fue revocado
 * (Google responde `invalid_grant` al renovarlo). Apps OAuth en estado
 * "Testing" expiran el refresh token a los 7 días — de ahí que esto reaparezca
 * periódicamente hasta publicar la pantalla de consentimiento.
 */
export class DriveTokenExpiredError extends Error {
  constructor() {
    super('DRIVE_TOKEN_EXPIRED')
    this.name = 'DriveTokenExpiredError'
  }
}

/**
 * Error tipado: el token es válido pero NO trae el scope de Drive. Pasa cuando
 * el usuario reconecta y no marca la casilla de permiso de Drive en la pantalla
 * de consentimiento de Google (consent granular). La subida llega autenticada
 * pero sin permiso → "Request had insufficient authentication scopes".
 */
export class DriveScopeError extends Error {
  constructor() {
    super('DRIVE_SCOPE_MISSING')
    this.name = 'DriveScopeError'
  }
}

/** Detecta el `invalid_grant` venga como venga (GaxiosError, message, code). */
export function isInvalidGrant(err: unknown): boolean {
  const e = err as {
    response?: { data?: { error?: string } }
    message?: unknown
    code?: unknown
  }
  if (e?.response?.data?.error === 'invalid_grant') return true
  if (e?.code === 'invalid_grant') return true
  const msg = typeof e?.message === 'string' ? e.message : ''
  return msg.includes('invalid_grant')
}

/** Detecta el caso "token sin scope de Drive" (403 / insufficient scopes). */
export function isInsufficientScope(err: unknown): boolean {
  const e = err as {
    response?: { data?: { error?: { errors?: { reason?: string }[] } } }
    message?: unknown
    code?: unknown
  }
  // Sólo el caso de SCOPE faltante, no un 403 genérico de carpeta sin permiso
  // (ese llega como `insufficientFilePermissions`, que NO se reconecta arreglando).
  const reasons = e?.response?.data?.error?.errors?.map((x) => x.reason) ?? []
  if (reasons.includes('insufficientPermissions')) return true
  const msg = typeof e?.message === 'string' ? e.message.toLowerCase() : ''
  return msg.includes('insufficient authentication scopes')
}

/**
 * Ejecuta una operación de Drive y, si falla por token caducado/revocado,
 * limpia el `driveAuth` muerto (para que Ajustes muestre "desconectado" en vez
 * de mentir) y propaga un `DriveTokenExpiredError` que el callable traduce a un
 * mensaje accionable.
 */
async function runDrive<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (isInvalidGrant(err)) {
      await clearDriveAuth(uid).catch(() => {
        /* no bloquear el error real por un fallo al limpiar */
      })
      throw new DriveTokenExpiredError()
    }
    if (isInsufficientScope(err)) {
      // El token no sirve para subir: forzamos reconexión limpia.
      await clearDriveAuth(uid).catch(() => {})
      throw new DriveScopeError()
    }
    throw err
  }
}

/**
 * Resuelve qué uid de Drive usar para las operaciones de una empresa.
 *
 * 1. Si la empresa tiene `driveOwnerUid` explícito → ese (override manual).
 * 2. Si no, el primer miembro con rol `owner` y status `active`.
 * 3. Si no hay owner activo, cae al `fallbackUid` (el del request) — comportamiento legacy.
 */
export async function resolveDriveUid(companyId: string, fallbackUid: string): Promise<string> {
  const companyRef = db.collection('companies').doc(companyId)
  const companySnap = await companyRef.get()
  const explicit = (companySnap.data() as { driveOwnerUid?: string } | undefined)?.driveOwnerUid
  if (explicit) return explicit
  const owners = await companyRef.collection('members').where('role', '==', 'owner').limit(10).get()
  const active = owners.docs.filter((d) => (d.data() as { status?: string }).status === 'active')
  // Con varios owners, el primero que devuelve la query (sin orderBy → orden NO
  // estable) puede no tener Drive conectado. Preferir el owner que SÍ tenga
  // refreshToken; caer al primer owner activo / fallback sólo si ninguno lo tiene.
  for (const d of active) {
    const auth = await getUserDriveAuth(d.id)
    if (auth?.refreshToken) return d.id
  }
  if (active.length > 0) return active[0].id
  return fallbackUid
}

/**
 * Devuelve un cliente de Drive autenticado con el refresh token del usuario.
 * Lanza error si no hay token configurado.
 */
export async function getDriveForUser(uid: string): Promise<drive_v3.Drive> {
  const auth = await getUserDriveAuth(uid)
  if (!auth?.refreshToken) {
    throw new Error('DRIVE_NOT_CONNECTED')
  }
  const client = createOAuthClient()
  client.setCredentials({ refresh_token: auth.refreshToken })
  return google.drive({ version: 'v3', auth: client })
}

// ─── Helpers de carpetas y upload, ahora por-company ──────────────────────

interface FolderCacheEntry {
  driveFolderId: string
  createdAt: number
}

async function getCachedFolder(companyId: string, path: string): Promise<string | null> {
  const docId = encodeURIComponent(path)
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection('drive-folders')
    .doc(docId)
    .get()
  if (!snap.exists) return null
  const data = snap.data() as FolderCacheEntry
  return data.driveFolderId ?? null
}

async function setCachedFolder(companyId: string, path: string, driveFolderId: string): Promise<void> {
  const docId = encodeURIComponent(path)
  await db
    .collection('companies')
    .doc(companyId)
    .collection('drive-folders')
    .doc(docId)
    .set({ driveFolderId, path, createdAt: Date.now() })
}

async function findFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
): Promise<string | null> {
  const escapedName = name.replace(/'/g, "\\'")
  const q = `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  const list = await drive.files.list({
    q,
    fields: 'files(id, name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  return list.data.files?.[0]?.id ?? null
}

// Las carpetas de mes se crearon históricamente sin prefijo numérico ("Julio");
// hoy se piden como "07-Julio". Si el nombre pedido es un mes con prefijo,
// devuelve el nombre viejo para buscar/renombrar la carpeta existente en vez
// de crear una duplicada.
function legacyMonthName(name: string): string | null {
  const m = /^\d{2}-(.+)$/.exec(name)
  return m && MESES_ES.includes(m[1]) ? m[1] : null
}

async function findOrCreateFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
): Promise<string> {
  const existing = await findFolder(drive, parentId, name)
  if (existing) return existing

  const legacy = legacyMonthName(name)
  if (legacy) {
    const legacyId = await findFolder(drive, parentId, legacy)
    if (legacyId) {
      await drive.files.update({
        fileId: legacyId,
        requestBody: { name },
        supportsAllDrives: true,
      })
      return legacyId
    }
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  if (!created.data.id) throw new Error(`No se pudo crear la carpeta "${name}"`)
  return created.data.id
}

export async function ensureFolderPath(
  uid: string,
  companyId: string,
  rootFolderId: string,
  segments: string[],
): Promise<string> {
  const drive = await getDriveForUser(uid)
  let parent = rootFolderId
  const acc: string[] = []
  for (const seg of segments) {
    acc.push(seg)
    // El cache key incluye el rootFolderId porque una misma empresa puede tener
    // varias carpetas raíz (facturación, descuentos, ...) y cada una su propio
    // árbol Año/Mes — sin el prefijo se cruzarían.
    const cacheKey = [rootFolderId, ...acc].join('/')
    const cached = await getCachedFolder(companyId, cacheKey)
    if (cached) {
      parent = cached
      continue
    }
    const folderId = await runDrive(uid, () => findOrCreateFolder(drive, parent, seg))
    await setCachedFolder(companyId, cacheKey, folderId)
    parent = folderId
  }
  return parent
}

export interface UploadResult {
  driveFileId: string
  webViewLink: string
  fileName: string
}

export async function uploadFile(
  uid: string,
  parentFolderId: string,
  fileName: string,
  mimeType: string,
  fileBase64: string,
): Promise<UploadResult> {
  const drive = await getDriveForUser(uid)
  const buffer = Buffer.from(fileBase64, 'base64')
  const body = Readable.from(buffer)
  const created = await runDrive(uid, () =>
    drive.files.create({
      requestBody: { name: fileName, parents: [parentFolderId] },
      media: { mimeType, body },
      fields: 'id, webViewLink, name',
      supportsAllDrives: true,
    }),
  )
  if (!created.data.id || !created.data.webViewLink) {
    throw new Error('Drive no retornó id/webViewLink al subir el archivo')
  }
  return {
    driveFileId: created.data.id,
    webViewLink: created.data.webViewLink,
    fileName: created.data.name ?? fileName,
  }
}

/**
 * Sube un archivo y, si ya existe uno con el mismo nombre en la carpeta, lo
 * reemplaza en vez de duplicar. Pensado para la hoja de seguimiento mensual:
 * cada mes hay un único archivo que se sobreescribe al regenerarlo.
 *
 * `convertToMimeType` hace que Drive convierta el contenido subido a un tipo
 * nativo de Google (p. ej. .xlsx → Google Sheet) usando SOLO el scope de Drive,
 * sin necesidad del scope de Sheets. Al actualizar un archivo que ya es nativo
 * de Google, subir media .xlsx reemplaza su contenido y Drive lo re-convierte.
 */
export async function uploadOrReplaceFile(
  uid: string,
  parentFolderId: string,
  fileName: string,
  mediaMimeType: string,
  fileBase64: string,
  convertToMimeType?: string,
): Promise<UploadResult> {
  const drive = await getDriveForUser(uid)
  const buffer = Buffer.from(fileBase64, 'base64')

  return runDrive(uid, async () => {
    const escapedName = fileName.replace(/'/g, "\\'")
    const list = await drive.files.list({
      q: `'${parentFolderId}' in parents and name = '${escapedName}' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    const existing = list.data.files?.[0]

    const result = existing?.id
      ? await drive.files.update({
          fileId: existing.id,
          // Forzamos el tipo de conversión también al actualizar: si el archivo
          // previo no fuese un Sheet nativo (p. ej. un .xlsx crudo legacy),
          // esto garantiza que quede convertido igual y no se rompa la idempotencia.
          requestBody: convertToMimeType ? { mimeType: convertToMimeType } : {},
          media: { mimeType: mediaMimeType, body: Readable.from(buffer) },
          fields: 'id, webViewLink, name',
          supportsAllDrives: true,
        })
      : await drive.files.create({
          requestBody: {
            name: fileName,
            parents: [parentFolderId],
            ...(convertToMimeType ? { mimeType: convertToMimeType } : {}),
          },
          media: { mimeType: mediaMimeType, body: Readable.from(buffer) },
          fields: 'id, webViewLink, name',
          supportsAllDrives: true,
        })

    if (!result.data.id || !result.data.webViewLink) {
      throw new Error('Drive no retornó id/webViewLink al guardar el archivo')
    }
    return {
      driveFileId: result.data.id,
      webViewLink: result.data.webViewLink,
      fileName: result.data.name ?? fileName,
    }
  })
}

/**
 * Borra un archivo de Drive por id. Idempotente: si el archivo ya no existe
 * (404), devuelve `notFound: true` sin lanzar — el caller lo trata como éxito.
 * Cualquier otro error de Drive sí se propaga (incluyendo invalid_grant y
 * insufficient scopes, que se traducen vía runDrive a los errores tipados).
 */
export async function deleteDriveFile(
  uid: string,
  fileId: string,
): Promise<{ deleted: boolean; notFound: boolean }> {
  const drive = await getDriveForUser(uid)
  return runDrive(uid, async () => {
    try {
      await drive.files.delete({ fileId, supportsAllDrives: true })
      return { deleted: true, notFound: false }
    } catch (err) {
      // Detecta "no existe" cubriendo las formas en que googleapis lo devuelve:
      // code numérico, code como string ("404"), status del response, o reason
      // del payload ("notFound" en errors[0]).
      const e = err as {
        code?: number | string
        response?: { status?: number; data?: { error?: { errors?: { reason?: string }[] } } }
      }
      const codeNum = typeof e.code === 'number' ? e.code : Number(e.code)
      const status = Number.isFinite(codeNum) ? codeNum : e.response?.status
      const reasons = e.response?.data?.error?.errors?.map((x) => x.reason) ?? []
      if (status === 404 || reasons.includes('notFound')) {
        return { deleted: false, notFound: true }
      }
      throw err
    }
  })
}

/**
 * Descarga un archivo de Drive y devuelve sus bytes + mimeType. Usado para
 * recuperar la factura y el comprobante ya subidos y fusionarlos en un PDF.
 */
export async function downloadFile(
  uid: string,
  fileId: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const drive = await getDriveForUser(uid)
  return runDrive(uid, async () => {
    const meta = await drive.files.get({
      fileId,
      fields: 'mimeType',
      supportsAllDrives: true,
    })
    const media = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' },
    )
    return {
      buffer: Buffer.from(media.data as ArrayBuffer),
      mimeType: meta.data.mimeType ?? 'application/octet-stream',
    }
  })
}

/**
 * Mueve un archivo de Drive a otra carpeta (posiblemente de otra empresa).
 *
 *  - **Mismo dueño de Drive** (`uidFrom === uidTo`, caso típico Blue↔Blue):
 *    reparent con `addParents`/`removeParents`. Conserva `driveFileId` y
 *    `webViewLink` — el `PayableFile` no cambia.
 *  - **Dueños distintos:** no se puede reparentar entre cuentas, así que se
 *    descarga del Drive origen, se sube al destino y se borra el original.
 *    Genera un `driveFileId`/`webViewLink` NUEVOS — el caller debe persistirlos.
 *
 * Devuelve los datos (quizá nuevos) del archivo ya en destino.
 */
export async function moveDriveFile(
  uidFrom: string,
  uidTo: string,
  fileId: string,
  targetFolderId: string,
  fileName: string,
): Promise<{ sameAccount: boolean; driveFileId: string; webViewLink: string; fileName: string }> {
  if (uidFrom === uidTo) {
    const drive = await getDriveForUser(uidFrom)
    return runDrive(uidFrom, async () => {
      const meta = await drive.files.get({
        fileId,
        fields: 'parents',
        supportsAllDrives: true,
      })
      const prevParents = (meta.data.parents ?? []).join(',')
      const updated = await drive.files.update({
        fileId,
        addParents: targetFolderId,
        removeParents: prevParents || undefined,
        fields: 'id, webViewLink, name',
        supportsAllDrives: true,
      })
      if (!updated.data.id) throw new Error('Drive no retornó id al mover el archivo')
      return {
        sameAccount: true,
        driveFileId: updated.data.id,
        webViewLink: updated.data.webViewLink ?? '',
        fileName: updated.data.name ?? fileName,
      }
    })
  }

  // Cuentas distintas: copiar bytes y borrar el original.
  const { buffer, mimeType } = await downloadFile(uidFrom, fileId)
  const uploaded = await uploadFile(uidTo, targetFolderId, fileName, mimeType, buffer.toString('base64'))
  // Borrado best-effort del original: si falla queda un huérfano recuperable,
  // pero la copia en destino ya existe y es la que referenciará la tx.
  await deleteDriveFile(uidFrom, fileId).catch((err) => {
    console.warn('[moveDriveFile] no se pudo borrar el original tras copiar', { fileId, err })
  })
  return {
    sameAccount: false,
    driveFileId: uploaded.driveFileId,
    webViewLink: uploaded.webViewLink,
    fileName: uploaded.fileName,
  }
}

export async function validateRootFolderAccess(
  uid: string,
  rootFolderId: string,
): Promise<{ ok: true; folderName: string } | { ok: false; error: string }> {
  try {
    const drive = await getDriveForUser(uid)
    const meta = await drive.files.get({
      fileId: rootFolderId,
      fields: 'id, name, mimeType, capabilities(canAddChildren)',
      supportsAllDrives: true,
    })
    if (meta.data.mimeType !== 'application/vnd.google-apps.folder') {
      return { ok: false, error: 'El ID no corresponde a una carpeta' }
    }
    if (!meta.data.capabilities?.canAddChildren) {
      return { ok: false, error: 'No tienes permiso de escritura en esta carpeta' }
    }
    return { ok: true, folderName: meta.data.name ?? 'sin nombre' }
  } catch (err) {
    if (isInvalidGrant(err)) {
      await clearDriveAuth(uid).catch(() => {})
      return {
        ok: false,
        error: 'El Drive se desconectó (token caducado). El propietario debe reconectarlo en Ajustes → Compañías.',
      }
    }
    if (isInsufficientScope(err)) {
      await clearDriveAuth(uid).catch(() => {})
      return {
        ok: false,
        error: 'La conexión de Drive no concedió el permiso completo. Reconecta y marca TODAS las casillas de permiso de Google Drive.',
      }
    }
    const msg = (err as Error).message ?? 'Error desconocido al validar la carpeta'
    if (msg === 'DRIVE_NOT_CONNECTED') {
      return { ok: false, error: 'Conecta Drive primero antes de validar la carpeta.' }
    }
    return { ok: false, error: msg }
  }
}
