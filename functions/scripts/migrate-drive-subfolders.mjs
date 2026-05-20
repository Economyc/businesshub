// Migración de un solo uso: reorganiza los archivos que ya están en Drive dentro
// de cada {root}/{Año}/{Mes}/ en tres subcarpetas:
//   - "PDFs consolidados"      → PDF combinado factura+pago
//   - "Seguimiento"            → Excel/Google Sheet de seguimiento del mes
//   - "Facturas y pagos sueltos" → facturas/comprobantes individuales
//
// Idempotente: solo mueve archivos que aún están sueltos en la raíz del mes.
// Requiere ADC (gcloud auth) para Firestore y los secrets DRIVE_OAUTH_CLIENT_ID
// / DRIVE_OAUTH_CLIENT_SECRET en el entorno para refrescar el token del owner.

import admin from 'firebase-admin'
import { google } from 'googleapis'

const CLIENT_ID = process.env.DRIVE_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.DRIVE_OAUTH_CLIENT_SECRET
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan DRIVE_OAUTH_CLIENT_ID / DRIVE_OAUTH_CLIENT_SECRET en el entorno')
  process.exit(1)
}

const CONSOLIDATED = 'PDFs consolidados'
const TRACKING = 'Seguimiento'
const LOOSE = 'Facturas y pagos sueltos'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const MESES = new Set([
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
])

admin.initializeApp({ projectId: 'empresas-bf' })
const db = admin.firestore()

async function resolveOwnerUid(companyDoc) {
  const explicit = companyDoc.data().driveOwnerUid
  if (explicit) return explicit
  const owners = await companyDoc.ref.collection('members').where('role', '==', 'owner').limit(10).get()
  const active = owners.docs.find((d) => d.data().status === 'active')
  return active ? active.id : null
}

function classify(name) {
  if (name.includes('Factura+Pago')) return CONSOLIDATED
  if (name.startsWith('Seguimiento facturas')) return TRACKING
  return LOOSE
}

async function listChildren(drive, parentId, foldersOnly = false) {
  const out = []
  let pageToken
  do {
    const q =
      `'${parentId}' in parents and trashed = false` +
      (foldersOnly ? ` and mimeType = '${FOLDER_MIME}'` : '')
    const res = await drive.files.list({
      q,
      fields: 'nextPageToken, files(id,name,mimeType)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    out.push(...(res.data.files || []))
    pageToken = res.data.nextPageToken
  } while (pageToken)
  return out
}

async function findOrCreateFolder(drive, parentId, name) {
  const esc = name.replace(/'/g, "\\'")
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${esc}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  if (res.data.files?.[0]?.id) return res.data.files[0].id
  const c = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  })
  return c.data.id
}

const comps = await db.collection('companies').get()
let totalMoved = 0
for (const c of comps.docs) {
  const root = c.data().driveRootFolderId
  if (!root) continue
  const uid = await resolveOwnerUid(c)
  if (!uid) { console.log('  (sin owner)', c.id); continue }
  const auth = (await db.collection('users').doc(uid).get()).data()?.driveAuth
  if (!auth?.refreshToken) { console.log('  (sin token Drive)', c.id); continue }

  const oauth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET)
  oauth.setCredentials({ refresh_token: auth.refreshToken })
  const drive = google.drive({ version: 'v3', auth: oauth })

  console.log('== Empresa', c.data().name, `[${c.id}]`)
  const years = await listChildren(drive, root, true)
  for (const y of years) {
    if (!/^\d{4}$/.test(y.name)) continue
    const months = await listChildren(drive, y.id, true)
    for (const m of months) {
      if (!MESES.has(m.name)) continue
      const children = await listChildren(drive, m.id, false)
      const filesToMove = children.filter((f) => f.mimeType !== FOLDER_MIME)
      if (filesToMove.length === 0) continue
      const subCache = {}
      let moved = 0
      for (const f of filesToMove) {
        const target = classify(f.name)
        if (!subCache[target]) subCache[target] = await findOrCreateFolder(drive, m.id, target)
        await drive.files.update({
          fileId: f.id,
          addParents: subCache[target],
          removeParents: m.id,
          fields: 'id',
          supportsAllDrives: true,
        })
        moved++
      }
      totalMoved += moved
      console.log(`   ${y.name}/${m.name}: ${moved} archivos movidos`)
    }
  }
}
console.log('Migración lista. Total movidos:', totalMoved)
process.exit(0)
