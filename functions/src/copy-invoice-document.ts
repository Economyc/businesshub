// Copia el documento (sourceDocument) de una factura de una empresa al Drive de
// otra. Lo usa Ecore al convertir una factura pendiente en gasto compartido: la
// factura se queda en su local con su parte y cada local participante recibe la
// suya con una COPIA del soporte en su propio Drive, igual que cuando el gasto
// compartido se crea desde cero.
//
// Sólo copia el archivo — no toca Firestore. El cliente escribe el reparto
// después, en una transacción, con las refs que devuelve este callable.
//
// El archivo se resuelve server-side a partir de la tx: nunca se acepta un
// driveFileId del cliente (con el token del dueño del Drive se podría leer
// cualquier archivo suyo).

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import type { Timestamp } from 'firebase-admin/firestore'
import { db } from './firestore.js'
import {
  resolveDriveUid,
  getUserDriveAuth,
  downloadFile,
  driveClientId,
  driveClientSecret,
  DriveTokenExpiredError,
  DriveScopeError,
} from './services/drive-oauth.js'
import { assertCompanyMember } from './utils/company-access.js'
import { uploadCompanyDocument } from './upload-document-to-drive.js'

interface Input {
  fromCompanyId: string
  transactionId: string
  toCompanyId: string
}

interface TxLike {
  documentKind?: string
  date?: Timestamp
  docNumber?: string
  payeeRef?: { name?: string }
  sourceDocument?: { driveFileId?: string; fileName?: string; mimeType?: string }
}

interface CopyResult {
  driveFileId: string
  webViewLink: string
  fileName: string
  mimeType: string
}

const SECRETS = [driveClientId, driveClientSecret]

export const copyInvoiceDocumentToCompany = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 120, secrets: SECRETS },
  async (request): Promise<CopyResult> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login requerido')
    }
    const data = request.data as Input
    const fromCompanyId = typeof data?.fromCompanyId === 'string' ? data.fromCompanyId.trim() : ''
    const toCompanyId = typeof data?.toCompanyId === 'string' ? data.toCompanyId.trim() : ''
    const transactionId = typeof data?.transactionId === 'string' ? data.transactionId.trim() : ''
    if (!fromCompanyId) throw new HttpsError('invalid-argument', 'fromCompanyId requerido')
    if (!toCompanyId) throw new HttpsError('invalid-argument', 'toCompanyId requerido')
    if (!transactionId) throw new HttpsError('invalid-argument', 'transactionId requerido')
    if (fromCompanyId === toCompanyId) {
      throw new HttpsError('invalid-argument', 'La empresa origen y destino son la misma')
    }

    const uid = request.auth.uid
    await assertCompanyMember(uid, fromCompanyId)
    await assertCompanyMember(uid, toCompanyId)

    const snap = await db
      .collection('companies')
      .doc(fromCompanyId)
      .collection('transactions')
      .doc(transactionId)
      .get()
    if (!snap.exists) throw new HttpsError('not-found', 'La factura ya no existe.')
    const tx = snap.data() as TxLike

    if (tx.documentKind !== 'invoice') {
      throw new HttpsError('failed-precondition', 'Sólo se puede copiar el documento de una factura.')
    }
    const source = tx.sourceDocument
    if (!source?.driveFileId) {
      throw new HttpsError('failed-precondition', 'La factura no tiene documento adjunto.')
    }

    console.log('[copyInvoiceDocumentToCompany] start', { fromCompanyId, toCompanyId, transactionId, uid })

    // ── Descargar del Drive de la empresa origen ─────────────────────────
    const driveUidFrom = await resolveDriveUid(fromCompanyId, uid)
    const fromAuth = await getUserDriveAuth(driveUidFrom)
    if (!fromAuth?.refreshToken) {
      throw new HttpsError(
        'failed-precondition',
        'El Drive de la empresa de la factura no está conectado, no se puede leer el documento para copiarlo.',
      )
    }

    let file: { buffer: Buffer; mimeType: string }
    try {
      file = await downloadFile(driveUidFrom, source.driveFileId)
    } catch (err) {
      if (err instanceof DriveTokenExpiredError) {
        throw new HttpsError(
          'failed-precondition',
          'El Drive se desconectó (sesión de Google caducada). El propietario debe reconectar Drive e intentar de nuevo.',
        )
      }
      if (err instanceof DriveScopeError) {
        throw new HttpsError(
          'failed-precondition',
          'La conexión de Drive no tiene el permiso completo. Reconecta marcando TODAS las casillas e intenta de nuevo.',
        )
      }
      console.error('[copyInvoiceDocumentToCompany] error descargando el documento', err)
      throw new HttpsError('internal', 'No se pudo leer el documento en Drive. Intenta de nuevo.')
    }

    // ── Subir al Drive de la empresa destino ─────────────────────────────
    // Mismo cuerpo que el upload normal: resuelve el Drive del dueño destino, la
    // carpeta Año/Mes/…/Facturas, el nombre y los errores de token/scope.
    const mimeType = source.mimeType || file.mimeType
    const uploaded = await uploadCompanyDocument(uid, {
      companyId: toCompanyId,
      docType: 'Factura',
      supplierName: tx.payeeRef?.name?.trim() || 'Proveedor',
      docNumber: tx.docNumber?.trim() || 'S-N',
      date: tx.date?.toMillis?.() ?? Date.now(),
      fileBase64: file.buffer.toString('base64'),
      fileName: source.fileName || 'Factura',
      mimeType,
    })

    console.log('[copyInvoiceDocumentToCompany] done', {
      fromCompanyId,
      toCompanyId,
      transactionId,
      driveFileId: uploaded.driveFileId,
    })

    return { ...uploaded, mimeType }
  },
)
