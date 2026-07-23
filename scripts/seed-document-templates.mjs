#!/usr/bin/env node
// Siembra el catálogo de plantillas del módulo Documentos de Ecore
// (colección raíz /documentTemplates + archivos en Storage bajo
// document-templates/). Idempotente: upsert por `name` — re-ejecutar
// actualiza el archivo y borra el objeto viejo, no duplica.
//
// Uso:
//   node scripts/seed-document-templates.mjs [--dir "C:\...\plantillas"]
//
// Estructura de la carpeta (default ~/Downloads/plantillas):
//   plantillas/
//     blue/     → plantillas de Blue Smash Burgers (Manila, Escondite, Envigado)
//     filipo/   → plantillas de Filipo (Belén, San Lucas)
//     general/  → comunes a ambas razones sociales
//   Archivos sueltos en la raíz de la carpeta cuentan como 'general'.
//   El nombre de la plantilla = nombre del archivo sin extensión (se puede
//   sobreescribir en OVERRIDES).
//
// Autenticación: gcloud auth application-default login (ADC).

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname, basename } from 'node:path'
import { homedir } from 'node:os'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const admin = require(join(__dirname, '../functions/node_modules/firebase-admin'))

const PROJECT_ID = 'empresas-bf'
const COLLECTION = 'documentTemplates'
const ENTITIES = new Set(['blue', 'filipo', 'general'])

// Overrides opcionales por archivo: nombre visible y/o razón social.
// Clave = nombre del archivo (con extensión), tal cual está en la carpeta.
const OVERRIDES = {
  // 'contrato-aux-cocina.docx': { name: 'Contrato Auxiliar de Cocina', entity: 'blue' },
}

const MIMES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const dirArgIdx = process.argv.indexOf('--dir')
const rootDir = dirArgIdx > -1 ? process.argv[dirArgIdx + 1] : join(homedir(), 'Downloads', 'plantillas')
if (!existsSync(rootDir)) {
  console.error(`No existe la carpeta ${rootDir}. Pasa --dir "ruta" o crea ~/Downloads/plantillas.`)
  process.exit(1)
}

admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()

// El nombre real del bucket varía entre proyectos (.firebasestorage.app es el
// nuevo default, .appspot.com el legado) — probar ambos.
async function resolveBucket() {
  for (const name of [`${PROJECT_ID}.firebasestorage.app`, `${PROJECT_ID}.appspot.com`]) {
    const bucket = admin.storage().bucket(name)
    const [exists] = await bucket.exists()
    if (exists) return bucket
  }
  throw new Error('No se encontró el bucket de Storage del proyecto.')
}

// Mismo header que fija el cliente de Ecore al subir: fuerza descarga con
// nombre correcto (RFC 5987 para tildes/eñes).
function contentDispositionFor(fileName) {
  const ascii = fileName.replace(/"/g, '').replace(/[^\x20-\x7e]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

// Recoge {absPath, fileName, entity} de la carpeta: subcarpetas blue/filipo/
// general definen la razón social; archivos en la raíz → general.
function collectFiles() {
  const out = []
  for (const entry of readdirSync(rootDir)) {
    const abs = join(rootDir, entry)
    if (statSync(abs).isDirectory()) {
      const entity = entry.toLowerCase()
      if (!ENTITIES.has(entity)) {
        console.warn(`  · Carpeta "${entry}" ignorada (no es blue/filipo/general)`)
        continue
      }
      for (const file of readdirSync(abs)) {
        const absFile = join(abs, file)
        if (statSync(absFile).isFile()) out.push({ absPath: absFile, fileName: file, entity })
      }
    } else {
      out.push({ absPath: abs, fileName: entry, entity: 'general' })
    }
  }
  return out.filter((f) => {
    if (MIMES[extname(f.fileName).toLowerCase()]) return true
    console.warn(`  · "${f.fileName}" ignorado (formato no admitido: usa pdf/doc/docx/xls/xlsx)`)
    return false
  })
}

const files = collectFiles()
if (files.length === 0) {
  console.error('No hay archivos admitidos en la carpeta.')
  process.exit(1)
}

const bucket = await resolveBucket()
console.log(`Bucket: ${bucket.name} — ${files.length} plantilla(s) en ${rootDir}\n`)

// Clave de upsert = nombre + razon social, NO solo el nombre: dos razones
// sociales pueden tener legitimamente la misma plantilla (ej. "Certificado
// Laboral" de Blue y de Filipo) y no deben pisarse entre si.
const keyOf = (name, entity) => `${entity}::${name}`
const existingSnap = await db.collection(COLLECTION).get()
const existingByKey = new Map(existingSnap.docs.map((d) => [keyOf(d.data().name, d.data().entity), d]))

for (const f of files) {
  const override = OVERRIDES[f.fileName] ?? {}
  const name = override.name ?? basename(f.fileName, extname(f.fileName))
  const entity = override.entity ?? f.entity
  const mimeType = MIMES[extname(f.fileName).toLowerCase()]
  const sizeBytes = statSync(f.absPath).size

  // El Admin SDK no genera token de descarga: fijarlo a mano y construir la
  // URL con el mismo formato que getDownloadURL() del cliente.
  const token = randomUUID()
  const storagePath = `document-templates/${randomUUID()}/${f.fileName}`
  await bucket.upload(f.absPath, {
    destination: storagePath,
    metadata: {
      contentType: mimeType,
      contentDisposition: contentDispositionFor(f.fileName),
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })
  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`

  const now = admin.firestore.Timestamp.now()
  const data = { name, entity, fileName: f.fileName, storagePath, downloadUrl, mimeType, sizeBytes, updatedAt: now }
  const existing = existingByKey.get(keyOf(name, entity))
  if (existing) {
    const oldPath = existing.data().storagePath
    await existing.ref.update(data)
    if (oldPath && oldPath !== storagePath) {
      await bucket.file(oldPath).delete().catch(() => {})
    }
    console.log(`  ✓ Actualizada: ${name} [${entity}]`)
  } else {
    await db.collection(COLLECTION).add({ ...data, createdAt: now })
    console.log(`  ✓ Creada: ${name} [${entity}]`)
  }
}

console.log('\nListo.')
