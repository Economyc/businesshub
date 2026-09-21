// Parser del reporte "Neto a pagar" de Siigo.
//
// El archivo llega con el encabezado en una fila cualquiera (Siigo mete filas
// de título arriba segun el reporte), asi que la fila de encabezado se busca
// por la celda literal "Nombre" en vez de asumir un indice.
//
// Dos formas del mismo reporte, ambas soportadas:
//   - Blue: una nomina por sede, sin columna "Sede".
//   - Filipo: FILIPO S.A.S. en una sola nomina con las dos sedes juntas y una
//     columna "Sede" (BELEN / SAN LUCAS / ADMINISTRATIVO) que dice donde va
//     cada fila. Ver "Como se reparte Filipo por sede" en el README de
//     "Nominas - Empresas/_script".
//
// Devuelve [{ siigoName, cedula, sede, amount }]. `sede` es null si el reporte
// no trae la columna.

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX = require(join(__dirname, '../../node_modules/xlsx'))

export function leerNetoAPagar(file) {
  const wb = XLSX.readFile(file)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true })

  const h = rows.findIndex((r) => Array.isArray(r) && r.some((c) => String(c).trim() === 'Nombre'))
  if (h < 0) throw new Error(`sin fila de encabezado ("Nombre") en ${file}`)

  const head = rows[h].map((c) => String(c ?? '').trim())
  const iName = head.indexOf('Nombre')
  const iId = head.indexOf('Identificación')
  const iNet = head.indexOf('Neto a Pagar')
  const iSede = head.indexOf('Sede') // -1 cuando el reporte viene por sede

  if (iId < 0 || iNet < 0) {
    throw new Error(`faltan columnas Identificación / Neto a Pagar en ${file} (encabezado: ${head.join(' | ')})`)
  }

  return rows
    .slice(h + 1)
    .filter((r) => r && r[iId] !== undefined && r[iId] !== '')
    .map((r) => {
      const amount = Number(r[iNet])
      if (!Number.isFinite(amount)) {
        throw new Error(`"Neto a Pagar" no numérico para ${r[iId]} en ${file}: ${JSON.stringify(r[iNet])}`)
      }
      return {
        siigoName: String(r[iName] ?? '').trim(),
        cedula: String(r[iId]).trim(),
        sede: iSede >= 0 ? String(r[iSede] ?? '').trim().toUpperCase() : null,
        amount: Math.round(amount),
      }
    })
}
