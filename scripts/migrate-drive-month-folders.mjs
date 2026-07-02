#!/usr/bin/env node
// Renombra las carpetas de mes existentes en Drive al formato con prefijo
// numérico: "Junio" → "06-Junio", para que el orden alfabético de Drive
// coincida con el cronológico.
//
// A partir del cambio en functions/src/utils/doc-naming.ts (monthFolderName)
// las carpetas nuevas ya nacen con prefijo y findOrCreateFolder renombra la
// legacy del mes cuando la toca; este script migra TODO el histórico de una
// vez (todas las empresas, árbol de facturación + descuentos, todos los años).
//
// El rename preserva el folder ID, así que links compartidos y el cache de
// companies/{id}/drive-folders siguen siendo válidos.
//
// Uso:
//   node scripts/migrate-drive-month-folders.mjs                 # DRY-RUN
//   node scripts/migrate-drive-month-folders.mjs --apply         # aplica
//   node scripts/migrate-drive-month-folders.mjs --company <id>  # una empresa
//
// Autenticación:
//   - Firestore: gcloud auth application-default login (ADC)
//   - Drive: refresh token del dueño de Drive de cada empresa (users/{uid}.driveAuth)
//     + client id/secret leídos de Secret Manager vía gcloud CLI.

import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
const require = createRequire(import.meta.url)
const admin = require('../functions/node_modules/firebase-admin')
const { google } = require('../functions/node_modules/googleapis')

const PROJECT_ID = 'empresas-bf'

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const onlyCompany = argv.includes('--company') ? argv[argv.indexOf('--company') + 1] : null

admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

function readSecret(name) {
  return execSync(
    `gcloud secrets versions access latest --secret=${name} --project=${PROJECT_ID}`,
    { encoding: 'utf8' },
  ).trim()
}

function monthFolderName(monthIndex) {
  return `${String(monthIndex + 1).padStart(2, '0')}-${MESES_ES[monthIndex]}`
}

// Mismo criterio que resolveDriveUid en functions/src/services/drive-oauth.ts:
// driveOwnerUid explícito > primer owner activo CON refreshToken.
async function resolveDriveUid(companyId, companyData) {
  if (companyData.driveOwnerUid) return companyData.driveOwnerUid
  const owners = await db
    .collection('companies').doc(companyId)
    .collection('members').where('role', '==', 'owner').limit(10).get()
  for (const d of owners.docs) {
    if (d.data().status !== 'active') continue
    const user = await db.collection('users').doc(d.id).get()
    if (user.data()?.driveAuth?.refreshToken) return d.id
  }
  return null
}

async function listSubfolders(drive, parentId) {
  const out = []
  let pageToken
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    out.push(...(res.data.files ?? []))
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)
  return out
}

async function migrateRoot(drive, label, rootId, stats) {
  const years = (await listSubfolders(drive, rootId)).filter((f) => /^\d{4}$/.test(f.name))
  for (const year of years) {
    const subs = await listSubfolders(drive, year.id)
    for (const sub of subs) {
      const idx = MESES_ES.indexOf(sub.name)
      if (idx === -1) continue // ya migrada ("06-Junio") u otra carpeta
      const newName = monthFolderName(idx)
      const clash = subs.find((s) => s.name === newName)
      if (clash) {
        console.log(`  [CONFLICTO] ${label}/${year.name}/${sub.name}: ya existe "${newName}" (${clash.id}) — resolver a mano`)
        stats.conflicts++
        continue
      }
      console.log(`  ${APPLY ? 'RENAME' : 'dry-run'} ${label}/${year.name}/${sub.name} → ${newName}`)
      if (APPLY) {
        await drive.files.update({
          fileId: sub.id,
          requestBody: { name: newName },
          supportsAllDrives: true,
        })
      }
      stats.renamed++
    }
  }
}

async function main() {
  console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN (usa --apply para ejecutar)'}\n`)
  const clientId = readSecret('DRIVE_OAUTH_CLIENT_ID')
  const clientSecret = readSecret('DRIVE_OAUTH_CLIENT_SECRET')

  const companiesSnap = await db.collection('companies').get()
  const stats = { renamed: 0, conflicts: 0, skipped: 0 }

  for (const doc of companiesSnap.docs) {
    if (onlyCompany && doc.id !== onlyCompany) continue
    const c = doc.data()
    const roots = [
      ['facturación', c.driveRootFolderId],
      ['descuentos', c.driveDiscountsFolderId],
    ].filter(([, id]) => !!id)
    if (roots.length === 0) continue

    const uid = await resolveDriveUid(doc.id, c)
    if (!uid) {
      console.log(`\n${c.name ?? doc.id}: sin dueño de Drive resoluble — SKIP`)
      stats.skipped++
      continue
    }
    const user = await db.collection('users').doc(uid).get()
    const refreshToken = user.data()?.driveAuth?.refreshToken
    if (!refreshToken) {
      console.log(`\n${c.name ?? doc.id}: dueño ${uid} sin Drive conectado — SKIP`)
      stats.skipped++
      continue
    }

    const oauth = new google.auth.OAuth2(clientId, clientSecret)
    oauth.setCredentials({ refresh_token: refreshToken })
    const drive = google.drive({ version: 'v3', auth: oauth })

    console.log(`\n${c.name ?? doc.id} (drive uid ${uid}):`)
    for (const [label, rootId] of roots) {
      try {
        await migrateRoot(drive, label, rootId, stats)
      } catch (err) {
        console.log(`  [ERROR] raíz ${label} (${rootId}): ${err.message}`)
      }
    }
  }

  console.log(`\nTotal: ${stats.renamed} renombradas, ${stats.conflicts} conflictos, ${stats.skipped} empresas sin Drive.`)
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
