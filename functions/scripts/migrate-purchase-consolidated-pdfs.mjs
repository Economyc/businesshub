// Migración de un solo uso: genera el PDF consolidado de las COMPRAS ya
// existentes y lo sube a {root}/{Año}/{Mes}/PDFs consolidados, igual que hace
// el flujo en vivo al crear una compra nueva. Las compras anteriores al cambio
// quedaron sin su PDF en esa carpeta, así que la contadora no podía revisarlas
// junto al resto de lo pagado.
//
// Por cada empresa recorre companies/{id}/transactions con documentKind ==
// 'purchase', toma las que tienen sourceDocument pero NO combinedDocument,
// envuelve el documento fuente como PDF y actualiza el campo combinedDocument.
//
// Idempotente: salta las compras que ya tienen combinedDocument (volver a
// correrlo no duplica nada). Best-effort por documento: si una falla, loguea y
// sigue con la siguiente.
//
// Reutiliza las mismas utilidades que la Cloud Function (compiladas en lib/),
// así el nombre del archivo y la carpeta coinciden con el flujo en vivo.
//
// Uso:
//   cd functions && npm run build           # asegura lib/ al día
//   node scripts/migrate-purchase-consolidated-pdfs.mjs --dry-run
//   node scripts/migrate-purchase-consolidated-pdfs.mjs
//
// Requiere ADC (gcloud auth application-default login) para Firestore y los
// secrets DRIVE_OAUTH_CLIENT_ID / DRIVE_OAUTH_CLIENT_SECRET en el entorno para
// refrescar el token del owner (igual que migrate-drive-subfolders-loose.mjs).

import admin from 'firebase-admin'
import { google } from 'googleapis'
import { Readable } from 'node:stream'
import { buildCombinedPdf } from '../lib/utils/build-combined-pdf.js'
import { buildDocLocation, SUBFOLDER_CONSOLIDATED } from '../lib/utils/doc-naming.js'

const CLIENT_ID = process.env.DRIVE_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.DRIVE_OAUTH_CLIENT_SECRET
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan DRIVE_OAUTH_CLIENT_ID / DRIVE_OAUTH_CLIENT_SECRET en el entorno')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const FOLDER_MIME = 'application/vnd.google-apps.folder'

admin.initializeApp({ projectId: 'empresas-bf' })
const db = admin.firestore()

async function resolveOwnerUid(companyDoc) {
  const explicit = companyDoc.data().driveOwnerUid
  if (explicit) return explicit
  const owners = await companyDoc.ref.collection('members').where('role', '==', 'owner').limit(10).get()
  const active = owners.docs.find((d) => d.data().status === 'active')
  return active ? active.id : null
}

async function findFolder(drive, parentId, name) {
  const esc = name.replace(/'/g, "\\'")
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${esc}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  return res.data.files?.[0]?.id ?? null
}

async function findOrCreateFolder(drive, parentId, name) {
  const existing = await findFolder(drive, parentId, name)
  if (existing) return existing
  const c = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  })
  return c.data.id
}

// Crea (o reutiliza) la ruta {root}/{year}/{month}/PDFs consolidados.
async function ensureConsolidatedFolder(drive, root, year, month) {
  const yearId = await findOrCreateFolder(drive, root, year)
  const monthId = await findOrCreateFolder(drive, yearId, month)
  return findOrCreateFolder(drive, monthId, SUBFOLDER_CONSOLIDATED)
}

async function downloadFile(drive, fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  )
  return Buffer.from(res.data)
}

async function uploadPdf(drive, folderId, name, buffer) {
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  })
  return { driveFileId: res.data.id, webViewLink: res.data.webViewLink }
}

const comps = await db.collection('companies').get()
let totalConsolidated = 0
let totalSkippedExisting = 0
let totalSkippedNoData = 0
let totalErrors = 0

for (const c of comps.docs) {
  const root = c.data().driveRootFolderId
  if (!root) continue

  const purchases = await c.ref.collection('transactions').where('documentKind', '==', 'purchase').get()
  // Compras con documento fuente y sin consolidado: las únicas que hay que migrar.
  const pending = purchases.docs.filter(
    (d) => d.data().sourceDocument?.driveFileId && !d.data().combinedDocument,
  )
  totalSkippedExisting += purchases.size - pending.length

  if (pending.length === 0) continue

  console.log('== Empresa', c.data().name, `[${c.id}]`, `— ${pending.length} compra(s) por consolidar`)

  // Drive del owner (mismo patrón que migrate-drive-subfolders-loose.mjs).
  const uid = await resolveOwnerUid(c)
  if (!uid) { console.log('  (sin owner) — saltada'); continue }
  const auth = (await db.collection('users').doc(uid).get()).data()?.driveAuth
  if (!auth?.refreshToken) { console.log('  (sin token Drive) — saltada'); continue }
  const oauth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET)
  oauth.setCredentials({ refresh_token: auth.refreshToken })
  const drive = google.drive({ version: 'v3', auth: oauth })

  // Cache de carpeta consolidada por "year/month" para no re-resolverla.
  const folderCache = {}

  for (const txDoc of pending) {
    const tx = txDoc.data()
    const supplierName = tx.payeeRef?.name
    const docNumber = tx.docNumber
    if (!supplierName || !docNumber) {
      totalSkippedNoData++
      console.log(`   [skip] ${txDoc.id}: falta ${!supplierName ? 'proveedor' : 'docNumber'}`)
      continue
    }

    const date = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date)
    const { year, month, baseName } = buildDocLocation(supplierName, 'Compra', docNumber, date)
    const fileName = `${baseName}.pdf`

    if (DRY_RUN) {
      console.log(`   [dry-run] ${year}/${month}: ${fileName}`)
      totalConsolidated++
      continue
    }

    try {
      const src = tx.sourceDocument
      const buffer = await downloadFile(drive, src.driveFileId)
      const mimeType = src.mimeType || 'application/octet-stream'
      const pdf = await buildCombinedPdf([{ buffer, mimeType }])

      const cacheKey = `${year}/${month}`
      if (!folderCache[cacheKey]) folderCache[cacheKey] = await ensureConsolidatedFolder(drive, root, year, month)
      const uploaded = await uploadPdf(drive, folderCache[cacheKey], fileName, pdf)

      await txDoc.ref.update({
        combinedDocument: {
          driveFileId: uploaded.driveFileId,
          driveWebViewLink: uploaded.webViewLink,
          fileName,
          mimeType: 'application/pdf',
          uploadedAt: admin.firestore.Timestamp.now(),
        },
      })
      totalConsolidated++
      console.log(`   [ok] ${year}/${month}: ${fileName}`)
    } catch (err) {
      totalErrors++
      console.log(`   [error] ${txDoc.id}: ${err?.message || err}`)
    }
  }
}

console.log('')
console.log(DRY_RUN ? 'Dry-run listo (no se escribió nada).' : 'Migración lista.')
console.log('  Consolidadas:', totalConsolidated)
console.log('  Saltadas (ya tenían combinado):', totalSkippedExisting)
console.log('  Saltadas (sin proveedor/docNumber):', totalSkippedNoData)
console.log('  Errores:', totalErrors)
process.exit(0)
