import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { db } from './firestore.js'
import {
  ensureFolderPath,
  uploadFile,
  getUserDriveAuth,
  driveClientId,
  driveClientSecret,
} from './services/drive-oauth.js'

// Callable de upload de fotos de Descuentos a Drive.
// Estructura: {Company.driveDiscountsFolderId} / {YYYY} / {MesEs} / {filename}
// Nombre: "Descuento - {motivo}[ - {detalle}] - {Mes DD YYYY}.{ext}"
// La carpeta raíz es propia por empresa (distinta de driveRootFolderId, que es
// la de facturación) — el usuario la configura en Ajustes → Compañías.

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface UploadInput {
  companyId: string
  reason: string
  detail?: string
  date: string | number
  fileBase64: string
  fileName: string
  mimeType: string
}

interface MemberDoc {
  userId: string
  role: string
  status: 'active' | 'invited' | 'suspended'
}

async function assertCompanyMember(uid: string, companyId: string): Promise<void> {
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection('members')
    .doc(uid)
    .get()
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No eres miembro de esta empresa')
  }
  const m = snap.data() as MemberDoc
  if (m.status !== 'active') {
    throw new HttpsError('permission-denied', 'Tu cuenta no está activa en esta empresa')
  }
}

function sanitizeForFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').trim()
}

function parseDate(input: string | number): Date {
  if (typeof input === 'number') return new Date(input)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(input)
}

function extFromMime(mime: string, fallbackName: string): string {
  if (mime.includes('pdf')) return 'pdf'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('heic')) return 'heic'
  if (mime.includes('heif')) return 'heif'
  const idx = fallbackName.lastIndexOf('.')
  return idx >= 0 ? fallbackName.slice(idx + 1).toLowerCase() : 'bin'
}

const SECRETS = [driveClientId, driveClientSecret]

export const uploadDiscountPhotoToDrive = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 60, secrets: SECRETS },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login requerido')
    }
    const data = request.data as UploadInput
    if (!data?.companyId) throw new HttpsError('invalid-argument', 'companyId requerido')
    if (!data.reason?.trim()) throw new HttpsError('invalid-argument', 'reason requerido')
    if (!data.fileBase64) throw new HttpsError('invalid-argument', 'fileBase64 requerido')
    if (!data.mimeType) throw new HttpsError('invalid-argument', 'mimeType requerido')

    await assertCompanyMember(request.auth.uid, data.companyId)

    const companySnap = await db.collection('companies').doc(data.companyId).get()
    if (!companySnap.exists) throw new HttpsError('not-found', 'Empresa no encontrada')
    const company = companySnap.data() as { name?: string; driveDiscountsFolderId?: string }
    if (!company.driveDiscountsFolderId) {
      throw new HttpsError(
        'failed-precondition',
        'Esta compañía no tiene carpeta de Descuentos configurada. Ve a Ajustes → Compañías.',
      )
    }

    const userAuth = await getUserDriveAuth(request.auth.uid)
    if (!userAuth?.refreshToken) {
      throw new HttpsError(
        'failed-precondition',
        'No has conectado tu Drive. Ve a Ajustes → Compañías y conecta tu Drive.',
      )
    }

    const date = parseDate(data.date ?? Date.now())
    const year = String(date.getFullYear())
    const month = MESES_ES[date.getMonth()]
    const dd = String(date.getDate()).padStart(2, '0')
    const ext = extFromMime(data.mimeType, data.fileName)

    const reason = sanitizeForFileName(data.reason)
    const detail = data.detail?.trim() ? sanitizeForFileName(data.detail) : ''
    const fileName = `Descuento - ${reason}${detail ? ` - ${detail}` : ''} - ${month} ${dd} ${year}.${ext}`

    const targetFolderId = await ensureFolderPath(
      request.auth.uid,
      data.companyId,
      company.driveDiscountsFolderId,
      [year, month],
    )
    const uploaded = await uploadFile(request.auth.uid, targetFolderId, fileName, data.mimeType, data.fileBase64)

    return {
      driveFileId: uploaded.driveFileId,
      webViewLink: uploaded.webViewLink,
      fileName: uploaded.fileName,
    }
  },
)
