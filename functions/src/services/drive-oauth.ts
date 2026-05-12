import { google, drive_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { Readable } from 'stream'
import { defineSecret } from 'firebase-functions/params'
import { db } from '../firestore.js'

// OAuth helper para Drive por empresa.
// El usuario autoriza una vez desde Settings → "Conectar Drive". El refresh
// token resultante queda en companies/{id}.driveAuth.refreshToken. A partir
// de ahí cada upload usa ese token para llamar a la Drive API en nombre del
// usuario, así los archivos quedan en SU Drive (con su quota, no la de la SA).

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

async function findOrCreateFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
): Promise<string> {
  const escapedName = name.replace(/'/g, "\\'")
  const q = `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  const list = await drive.files.list({
    q,
    fields: 'files(id, name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const existing = list.data.files?.[0]
  if (existing?.id) return existing.id

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
    const folderId = await findOrCreateFolder(drive, parent, seg)
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
  const created = await drive.files.create({
    requestBody: { name: fileName, parents: [parentFolderId] },
    media: { mimeType, body },
    fields: 'id, webViewLink, name',
    supportsAllDrives: true,
  })
  if (!created.data.id || !created.data.webViewLink) {
    throw new Error('Drive no retornó id/webViewLink al subir el archivo')
  }
  return {
    driveFileId: created.data.id,
    webViewLink: created.data.webViewLink,
    fileName: created.data.name ?? fileName,
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
    const msg = (err as Error).message ?? 'Error desconocido al validar la carpeta'
    if (msg === 'DRIVE_NOT_CONNECTED') {
      return { ok: false, error: 'Conecta Drive primero antes de validar la carpeta.' }
    }
    return { ok: false, error: msg }
  }
}
