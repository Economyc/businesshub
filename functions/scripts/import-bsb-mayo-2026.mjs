// ============================================================================
// Importación one-off — Blue Smash Burger, Mayo 2026
// ----------------------------------------------------------------------------
// Qué hace:
//  1. (Migración) Copia los proveedores existentes de companies/*/suppliers a
//     la colección raíz `suppliers` (preservando IDs). No borra los originales.
//  2. Crea en la colección raíz `suppliers` los proveedores de proveedores.json
//     que no existan todavía (categoría vacía — el usuario los categoriza luego).
//  3. Para las companies "Manila" y "Escondite", escanea las carpetas
//     `Pagos - Manila/05 - Mayo 2026/` y `Pagos - Oculta/05 - Mayo 2026/`,
//     sube cada factura y su comprobante de pago a Google Drive (misma estructura
//     que la app: {driveRootFolderId}/{YYYY}/{MesEs}/{archivo}) y crea la
//     transacción documentada (documentKind='invoice') en
//     companies/{companyId}/transactions con status paid/pending, amount y
//     paidDate tomados del Excel de seguimiento (scripts/valores-mayo-2026.json).
//
// Idempotente: no duplica proveedores (chequea por `name`) ni transacciones
// (chequea por `docNumber` + `payeeRef.name` + `documentKind='invoice'`).
//
// PREREQUISITOS:
//  - `gcloud auth application-default login`  (ADC para firebase-admin)
//  - `gcloud auth login`                       (para `gcloud secrets ...`)
//  - Las companies "Manila" y "Escondite" existen en BusinessHub, cada una con
//    `driveRootFolderId` configurado (Ajustes → Compañías → Drive).
//  - La cuenta del usuario (por defecto bluessmashburger@gmail.com) tiene Drive
//    conectado en la app (users/{uid}.driveAuth.refreshToken).
//
// USO (desde la carpeta functions/):
//   node scripts/import-bsb-mayo-2026.mjs [--dry-run]
//
// Variables de entorno opcionales (override):
//   BSB_DOCS_ROOT             ruta a "...\Documentos\Blue Smash Burger"
//   BSB_DRIVE_USER_EMAIL      email del usuario con Drive conectado
//   BSB_MANILA_COMPANY_ID     id de la company Manila (si la detección falla)
//   BSB_ESCONDITE_COMPANY_ID  id de la company Escondite
// ============================================================================

import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { google } from 'googleapis'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')
const PROJECT_ID = 'empresas-bf'
const DOCS_ROOT = process.env.BSB_DOCS_ROOT
  || 'C:\\Users\\sbdbu\\Documents\\Empresas\\Documentos\\Blue Smash Burger'
const DRIVE_USER_EMAIL = process.env.BSB_DRIVE_USER_EMAIL || 'bluessmashburger@gmail.com'
const MONTH_SUBDIR = '05 - Mayo 2026'

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}
const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
// [PENDIENTE - ]<Proveedor> - <Tipo> <Num> - <Mes> <DD> <YYYY>.<ext>
const FILE_RE = /^(PENDIENTE - )?(.+?) - (Factura|Cobro|Pago Externo|Pago|Reintegro) (\S+) - (\w+) (\d{2}) (\d{4})\.(\w+)$/
const FACTURA_TIPOS = new Set(['Factura', 'Cobro'])
const PAGO_PRIORITY = { 'Pago': 0, 'Pago Externo': 1, 'Reintegro': 2 }

// En BusinessHub las dos sedes son companies "Blue Smash Brgr" distinguidas por
// el campo `location` ("Manila" / "Escondite"). Hacemos match sobre location
// (y de paso sobre name por si acaso).
const SEDES = [
  { sede: 'Manila', folder: 'Pagos - Manila', envCompanyId: 'BSB_MANILA_COMPANY_ID', match: (c) => /manila/i.test(`${c.data.location ?? ''} ${c.name}`) },
  { sede: 'Escondite', folder: 'Pagos - Oculta', envCompanyId: 'BSB_ESCONDITE_COMPANY_ID', match: (c) => /escondite|oculta/i.test(`${c.data.location ?? ''} ${c.name}`) },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(...a)

function mimeFromExt(ext) {
  const e = ext.toLowerCase()
  if (e === 'pdf') return 'application/pdf'
  if (e === 'png') return 'image/png'
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg'
  if (e === 'webp') return 'image/webp'
  if (e === 'heic') return 'image/heic'
  return 'application/octet-stream'
}

function parseFileName(name) {
  // Grupos: 1=PENDIENTE? 2=prov 3=tipo 4=num 5=mes 6=dia 7=ano 8=ext
  const m = FILE_RE.exec(name)
  if (!m) return null
  const mesNum = MESES[m[5].toLowerCase()]
  if (!mesNum) return null
  return {
    pend: !!m[1],
    prov: m[2].trim(),
    tipo: m[3],
    num: m[4],
    date: new Date(Number(m[7]), mesNum - 1, Number(m[6])),
    ext: m[8].toLowerCase(),
    file: name,
  }
}

function getSecret(name) {
  return execSync(`gcloud secrets versions access latest --secret=${name} --project=${PROJECT_ID}`, {
    encoding: 'utf-8',
  }).trim()
}

// ── Drive helpers (espejo mínimo de functions/src/services/drive-oauth.ts) ──

let driveClient = null
const folderCache = new Map() // `${rootId}|${year}` y `${rootId}|${year}|${month}` -> folderId

async function findOrCreateFolder(drive, parentId, name) {
  const escaped = name.replace(/'/g, "\\'")
  const q = `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  const list = await drive.files.list({
    q, fields: 'files(id, name)', pageSize: 1,
    supportsAllDrives: true, includeItemsFromAllDrives: true,
  })
  const existing = list.data.files?.[0]
  if (existing?.id) return existing.id
  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id', supportsAllDrives: true,
  })
  if (!created.data.id) throw new Error(`No se pudo crear la carpeta "${name}"`)
  return created.data.id
}

async function ensureMonthFolder(rootFolderId, year, month) {
  const yKey = `${rootFolderId}|${year}`
  let yearId = folderCache.get(yKey)
  if (!yearId) {
    yearId = await findOrCreateFolder(driveClient, rootFolderId, year)
    folderCache.set(yKey, yearId)
  }
  const mKey = `${rootFolderId}|${year}|${month}`
  let monthId = folderCache.get(mKey)
  if (!monthId) {
    monthId = await findOrCreateFolder(driveClient, yearId, month)
    folderCache.set(mKey, monthId)
  }
  return monthId
}

// Sube un archivo local a Drive y devuelve el PayableFile listo para Firestore.
async function uploadToDrive(rootFolderId, localPath, prov, tipo, num, date, ext) {
  const year = String(date.getFullYear())
  const month = MESES_ES[date.getMonth()]
  const dd = String(date.getDate()).padStart(2, '0')
  const sanitize = (s) => s.replace(/[\\/:*?"<>|]/g, '').trim()
  const fileName = `${sanitize(prov)} - ${tipo} ${sanitize(num)} - ${month} ${dd} ${year}.${ext}`
  const mimeType = mimeFromExt(ext)
  if (DRY_RUN) {
    return { driveFileId: 'dry-run', driveWebViewLink: `dry-run://${fileName}`, fileName, mimeType, uploadedAt: Timestamp.now() }
  }
  const monthId = await ensureMonthFolder(rootFolderId, year, month)
  const buffer = readFileSync(localPath)
  const created = await driveClient.files.create({
    requestBody: { name: fileName, parents: [monthId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id, webViewLink, name', supportsAllDrives: true,
  })
  if (!created.data.id || !created.data.webViewLink) {
    throw new Error(`Drive no retornó id/webViewLink al subir ${fileName}`)
  }
  await sleep(400)
  return {
    driveFileId: created.data.id,
    driveWebViewLink: created.data.webViewLink,
    fileName: created.data.name ?? fileName,
    mimeType,
    uploadedAt: Timestamp.now(),
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  log(`\n=== Importación BSB Mayo 2026 ${DRY_RUN ? '(DRY RUN — no escribe nada)' : ''} ===\n`)

  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
  const db = getFirestore()
  db.settings({ ignoreUndefinedProperties: true })
  const auth = getAuth()

  // 1. Resolver companies Manila / Escondite
  const companiesSnap = await db.collection('companies').get()
  const allCompanies = companiesSnap.docs.map((d) => ({ id: d.id, name: d.data().name ?? '', data: d.data() }))
  const resolved = {}
  for (const s of SEDES) {
    const override = process.env[s.envCompanyId]
    if (override) {
      const found = allCompanies.find((c) => c.id === override)
      if (!found) { console.error(`Company id ${override} (${s.envCompanyId}) no existe.`); process.exit(1) }
      resolved[s.sede] = found
      continue
    }
    const matches = allCompanies.filter((c) => s.match(c))
    if (matches.length !== 1) {
      console.error(`No pude identificar la company "${s.sede}" sin ambigüedad (${matches.length} candidatas).`)
      console.error('Companies disponibles:')
      for (const c of allCompanies) console.error(`  ${c.id}  →  ${c.name} / ${c.data.location ?? '(sin location)'}`)
      console.error(`Define ${s.envCompanyId}=<id> y vuelve a correr.`)
      process.exit(1)
    }
    resolved[s.sede] = matches[0]
  }
  log('Companies:')
  for (const s of SEDES) log(`  ${s.sede}: ${resolved[s.sede].name} / ${resolved[s.sede].data.location ?? '?'}  (${resolved[s.sede].id})`)

  // Verificar driveRootFolderId
  for (const s of SEDES) {
    if (!resolved[s.sede].data.driveRootFolderId) {
      console.error(`La company "${resolved[s.sede].name}" no tiene driveRootFolderId. Configúralo en la app (Ajustes → Compañías → Drive) y vuelve a correr.`)
      process.exit(1)
    }
  }

  // 2. Drive auth del usuario
  let driveUid
  try {
    driveUid = (await auth.getUserByEmail(DRIVE_USER_EMAIL)).uid
  } catch {
    console.error(`No encontré el usuario ${DRIVE_USER_EMAIL} en Firebase Auth.`); process.exit(1)
  }
  const userSnap = await db.collection('users').doc(driveUid).get()
  const refreshToken = userSnap.exists ? userSnap.data()?.driveAuth?.refreshToken : null
  if (!refreshToken) {
    console.error(`El usuario ${DRIVE_USER_EMAIL} no tiene Drive conectado (users/${driveUid}.driveAuth.refreshToken vacío). Conéctalo en la app y vuelve a correr.`)
    process.exit(1)
  }
  if (!DRY_RUN) {
    const clientId = getSecret('DRIVE_OAUTH_CLIENT_ID')
    const clientSecret = getSecret('DRIVE_OAUTH_CLIENT_SECRET')
    const oauth = new google.auth.OAuth2(clientId, clientSecret)
    oauth.setCredentials({ refresh_token: refreshToken })
    driveClient = google.drive({ version: 'v3', auth: oauth })
    // Sanity check: leer el folder raíz de Manila para validar el token.
    try {
      await driveClient.files.get({ fileId: resolved.Manila.data.driveRootFolderId, fields: 'id, name', supportsAllDrives: true })
    } catch (e) {
      console.error('No pude acceder a Drive con el refresh token guardado:', e.message); process.exit(1)
    }
  }

  // 3. Migración: companies/*/suppliers → root suppliers (preservando id)
  const nameToId = new Map() // name.toLowerCase() -> root supplier id
  const rootSuppliersRef = db.collection('suppliers')
  const existingRoot = await rootSuppliersRef.get()
  for (const d of existingRoot.docs) {
    const n = (d.data().name ?? '').trim().toLowerCase()
    if (n) nameToId.set(n, d.id)
  }
  let migrated = 0
  for (const c of allCompanies) {
    const subSnap = await db.collection('companies').doc(c.id).collection('suppliers').get()
    for (const d of subSnap.docs) {
      const data = d.data()
      const n = (data.name ?? '').trim().toLowerCase()
      const rootDoc = await rootSuppliersRef.doc(d.id).get()
      if (!rootDoc.exists) {
        if (!DRY_RUN) {
          await rootSuppliersRef.doc(d.id).set({
            ...data,
            createdAt: data.createdAt ?? FieldValue.serverTimestamp(),
            updatedAt: data.updatedAt ?? FieldValue.serverTimestamp(),
          })
        }
        migrated++
        if (n && !nameToId.has(n)) nameToId.set(n, d.id)
      }
    }
  }
  log(`\nMigración de proveedores existentes → colección raíz: ${migrated} copiados${DRY_RUN ? ' (dry-run)' : ''}.`)

  // 4. Crear proveedores de proveedores.json que falten
  const provJson = JSON.parse(readFileSync(join(DOCS_ROOT, 'Automatizaciones', 'proveedores.json'), 'utf-8'))
  const provNames = Object.keys(provJson.proveedores ?? {})
  let createdSuppliers = 0
  for (const name of provNames) {
    const key = name.trim().toLowerCase()
    if (nameToId.has(key)) continue
    if (DRY_RUN) {
      nameToId.set(key, `dry-${createdSuppliers}`)
    } else {
      const ref = await rootSuppliersRef.add({
        name,
        identification: '',
        category: '',
        contactName: '',
        email: '',
        phone: '',
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      nameToId.set(key, ref.id)
    }
    createdSuppliers++
  }
  log(`Proveedores creados desde proveedores.json: ${createdSuppliers} de ${provNames.length} (resto ya existían).`)

  // 5. Cargar valores del Excel
  const valores = JSON.parse(readFileSync(join(__dirname, 'valores-mayo-2026.json'), 'utf-8'))

  // 6. Procesar cada sede
  const totals = { created: 0, skipped: 0, missingValue: 0, atipicos: [] }
  for (const s of SEDES) {
    const company = resolved[s.sede]
    const dir = join(DOCS_ROOT, s.folder, MONTH_SUBDIR)
    log(`\n--- Sede ${s.sede} → ${company.name} ---`)
    log(`Carpeta: ${dir}`)
    if (!existsSync(dir)) { log('  (no existe — se omite)'); continue }

    const facturas = new Map() // `${prov}|${num}` -> parsed
    const pagos = new Map()    // `${prov}|${num}` -> [parsed,...]
    for (const file of readdirSync(dir)) {
      const full = join(dir, file)
      const p = parseFileName(file)
      if (!p) { totals.atipicos.push(`${s.folder}/${MONTH_SUBDIR}/${file}`); continue }
      const k = `${p.prov}|${p.num}`
      if (FACTURA_TIPOS.has(p.tipo)) {
        if (facturas.has(k)) { log(`  ⚠ factura duplicada para ${k} — uso la primera`); continue }
        facturas.set(k, { ...p, full })
      } else {
        const arr = pagos.get(k) ?? []
        arr.push({ ...p, full })
        pagos.set(k, arr)
      }
    }

    // Cache de transacciones existentes por docNumber para idempotencia
    const txSnap = await db.collection('companies').doc(company.id).collection('transactions').get()
    const existingByDocNum = new Map() // docNumber -> [{name, kind}]
    for (const d of txSnap.docs) {
      const t = d.data()
      if (!t.docNumber) continue
      const arr = existingByDocNum.get(t.docNumber) ?? []
      arr.push({ name: t.payeeRef?.name ?? '', kind: t.documentKind ?? '' })
      existingByDocNum.set(t.docNumber, arr)
    }

    let created = 0, skipped = 0
    for (const [k, fac] of facturas) {
      const { prov, num } = fac
      // Idempotencia
      const dups = existingByDocNum.get(num) ?? []
      if (dups.some((x) => x.name === prov && x.kind === 'invoice')) {
        log(`  · skip (ya existe): ${prov} ${num}`)
        skipped++
        continue
      }

      const valKey = `${prov}|${num}`
      const valEntry = valores[s.sede]?.[valKey]
      const amount = valEntry?.amount
      if (amount == null) { totals.missingValue++; log(`  ⚠ sin valor en Excel para ${prov} ${num} — se crea sin amount`) }

      // Comprobantes de pago, ordenados por prioridad (Pago > Pago Externo > Reintegro)
      const pagoArr = (pagos.get(k) ?? []).slice().sort((a, b) => {
        const pa = PAGO_PRIORITY[a.tipo] ?? 9, pb = PAGO_PRIORITY[b.tipo] ?? 9
        return pa - pb || a.date - b.date
      })
      const status = pagoArr.length > 0 ? 'paid' : 'pending'

      // Subir factura
      const sourceDocument = await uploadToDrive(
        company.data.driveRootFolderId, fac.full, prov, fac.tipo, num, fac.date, fac.ext,
      )

      let paymentProof, paidDate, notes
      if (status === 'paid') {
        const main = pagoArr[0]
        paymentProof = await uploadToDrive(
          company.data.driveRootFolderId, main.full, prov, main.tipo, num, main.date, main.ext,
        )
        const extraLinks = []
        for (const extra of pagoArr.slice(1)) {
          const up = await uploadToDrive(
            company.data.driveRootFolderId, extra.full, prov, extra.tipo, num, extra.date, extra.ext,
          )
          extraLinks.push(`${extra.tipo}: ${up.driveWebViewLink}`)
        }
        if (extraLinks.length) notes = `Comprobantes adicionales — ${extraLinks.join(' | ')}`
        const pd = valEntry?.paidDate
        paidDate = pd ? Timestamp.fromDate(new Date(`${pd}T00:00:00`)) : Timestamp.fromDate(main.date)
      }

      const tx = {
        concept: prov,
        category: '',
        amount,
        type: 'expense',
        date: Timestamp.fromDate(fac.date),
        status,
        documentKind: 'invoice',
        docNumber: num,
        // proveedores.json marca prioridad "espera" para todos → 'waiting'.
        priority: 'waiting',
        payeeRef: { type: 'supplier', id: nameToId.get(prov.trim().toLowerCase()) ?? '', name: prov },
        sourceDocument,
        paymentProof,
        paidDate,
        notes,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }
      if (!DRY_RUN) {
        await db.collection('companies').doc(company.id).collection('transactions').add(tx)
      }
      log(`  + ${status === 'paid' ? '✓' : '·'} ${prov} ${num}  ${amount != null ? '$' + Math.round(amount).toLocaleString('es-CO') : '(sin valor)'}  [${status}]`)
      created++
    }
    log(`  Sede ${s.sede}: ${created} creadas, ${skipped} ya existían.`)
    totals.created += created
    totals.skipped += skipped
  }

  // 7. Resumen
  log(`\n=== Resumen ===`)
  log(`Proveedores migrados al root: ${migrated}`)
  log(`Proveedores nuevos creados:   ${createdSuppliers}`)
  log(`Transacciones creadas:        ${totals.created}`)
  log(`Transacciones ya existentes:  ${totals.skipped}`)
  if (totals.missingValue) log(`⚠ Facturas sin valor en Excel:  ${totals.missingValue} (revisar y completar a mano en la app)`)
  if (totals.atipicos.length) {
    log(`⚠ Archivos atípicos (ignorados): ${totals.atipicos.length}`)
    for (const a of totals.atipicos) log(`    ${a}`)
  }
  log(DRY_RUN ? '\n(DRY RUN — no se escribió nada. Quita --dry-run para ejecutar.)\n' : '\nListo.\n')
}

main().catch((e) => { console.error('\nERROR:', e); process.exit(1) })
