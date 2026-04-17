#!/usr/bin/env node
// Auditoría de ventas POS vs BusinessHub.
// Lee companies/{companyId}/pos-sales-cache desde Firestore (ADC),
// aplica la fórmula canónica ventaMonto y reporta agregados y
// distribuciones para diagnosticar la diferencia contra el POS.
//
// Uso:
//   node scripts/audit-pos-sales.mjs                      # lista empresas
//   node scripts/audit-pos-sales.mjs --company <id>       # mes actual
//   node scripts/audit-pos-sales.mjs --company <id> --from 2026-04-01 --to 2026-04-17
//   node scripts/audit-pos-sales.mjs --company <id> --target 130868935
//
// Autenticación: gcloud auth application-default login (ADC).

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

// firebase-admin está en functions/node_modules
const admin = require('../functions/node_modules/firebase-admin')

const PROJECT_ID = 'empresas-bf'
const SALES_COLLECTION = 'pos-sales-cache'
const POS_PROXY_URL = process.env.POS_PROXY_URL || 'https://posproxy-xfyucmyk7q-uc.a.run.app'

// ───────── CLI args ─────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) {
      const key = cur.slice(2)
      const next = arr[i + 1]
      acc.push([key, next && !next.startsWith('--') ? next : 'true'])
    }
    return acc
  }, [])
)

const companyId = args.company
const target = args.target ? Number(args.target) : null

function currentMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
  const today = String(now.getDate()).padStart(2, '0')
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${today}`,
    monthEnd: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  }
}

const mr = currentMonthRange()
const fromDate = args.from || mr.from
const toDate = args.to || mr.to

// ───────── Fórmula canónica (mirror de sales-calculations.ts) ─────────
function num(v) {
  return Number(v) || 0
}

function isAnuladaStrict(v) {
  return (v.estado_txt || '').toLowerCase() === 'comprobante anulado'
}

function sumPropinasCanonical(v) {
  const list = v.lista_propinas || []
  let s = 0
  for (const p of list) s += num(p.montoConIgv)
  if (s > 0) return s
  const pagos = v.pagosList || []
  for (const p of pagos) {
    const tipoStr = String(p.tipoPago ?? p.pagoventa_tipo ?? '').toLowerCase()
    if (tipoStr.includes('propina') || tipoStr.includes('tip')) {
      const monto = p.monto ?? p.pagoventa_monto
      s += num(monto)
    }
  }
  return s
}

function ventaMontoCanonical(v) {
  return num(v.total) + sumPropinasCanonical(v) + num(v.costoenvio)
}

// ───────── Formato ─────────
const COP = (n) => {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(Math.round(n))
  return sign + '$' + abs.toLocaleString('es-CO')
}
const pad = (s, n) => String(s).padEnd(n)
const padR = (s, n) => String(s).padStart(n)

function printRule(char = '─', n = 88) {
  console.log(char.repeat(n))
}
function printHeader(title) {
  console.log('')
  printRule('━')
  console.log('  ' + title)
  printRule('━')
}

// ───────── Init ─────────
if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID })
}
const db = admin.firestore()

async function listCompanies() {
  const snap = await db.collection('companies').get()
  const rows = []
  for (const d of snap.docs) {
    const data = d.data()
    rows.push({ id: d.id, name: data.name || '?', location: data.location || '' })
  }
  return rows
}

async function fetchLiveVentas(localIds, from, to) {
  const f1 = `${from} 00:00:00`
  const f2 = `${to} 23:59:59`
  const res = await fetch(POS_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'ventas-batch', params: { local_ids: localIds, f1, f2 } }),
  })
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Proxy error')
  return { ventas: json.data.ventas || [], rateLimited: !!json.data.rateLimited }
}

async function loadVentas(cid, from, to) {
  const snap = await db
    .collection('companies')
    .doc(cid)
    .collection(SALES_COLLECTION)
    .where('date', '>=', from)
    .where('date', '<=', to)
    .get()
  const ventas = []
  const docs = []
  for (const d of snap.docs) {
    const data = d.data()
    docs.push({ id: d.id, date: data.date, localId: data.localId, count: (data.ventas || []).length })
    if (Array.isArray(data.ventas)) ventas.push(...data.ventas)
  }
  return { ventas, docs }
}

// ───────── Reportes ─────────
function reportTotals(ventas) {
  let total = 0
  let propinasLista = 0
  let propinasFallback = 0
  let costoenvio = 0
  let impuestos = 0
  let sumaImpuestos = 0
  let anuladasTotal = 0
  let anuladasCount = 0
  let validCount = 0
  let pagosNoReconocidos = 0 // suma de pagosList no-propina excluyendo pagos normales

  for (const v of ventas) {
    const anul = isAnuladaStrict(v)
    if (anul) {
      anuladasCount++
      anuladasTotal += ventaMontoCanonical(v)
      continue
    }
    validCount++
    total += num(v.total)
    costoenvio += num(v.costoenvio)
    impuestos += num(v.impuestos)
    sumaImpuestos += num(v.suma_impuestos)
    // propinas desde lista
    let pl = 0
    for (const p of v.lista_propinas || []) pl += num(p.montoConIgv)
    propinasLista += pl
    // propinas fallback desde pagosList (cuando lista_propinas vacío)
    if (pl === 0) {
      for (const p of v.pagosList || []) {
        const tipoStr = String(p.tipoPago ?? p.pagoventa_tipo ?? '').toLowerCase()
        if (tipoStr.includes('propina') || tipoStr.includes('tip')) {
          propinasFallback += num(p.monto ?? p.pagoventa_monto)
        }
      }
    }
  }

  const ventaMontoTotal = total + propinasLista + propinasFallback + costoenvio

  printHeader('TOTALES (fórmula canónica)')
  console.log(`  Ventas válidas:               ${validCount}`)
  console.log(`  Anuladas (excluidas):         ${anuladasCount}  (${COP(anuladasTotal)})`)
  console.log('')
  console.log(`  Σ total (neto):               ${COP(total)}`)
  console.log(`  Σ propinas (lista_propinas):  ${COP(propinasLista)}`)
  console.log(`  Σ propinas (pagosList):       ${COP(propinasFallback)}`)
  console.log(`  Σ costoenvio:                 ${COP(costoenvio)}`)
  console.log(`  Σ impuestos:                  ${COP(impuestos)}`)
  console.log(`  Σ suma_impuestos:             ${COP(sumaImpuestos)}`)
  console.log('')
  console.log(`  ventaMonto TOTAL (actual):    ${COP(ventaMontoTotal)}   ← lo que ve BusinessHub`)
  console.log(`  + anuladas:                   ${COP(ventaMontoTotal + anuladasTotal)}`)
  console.log(`  + impuestos:                  ${COP(ventaMontoTotal + impuestos)}`)
  console.log(`  + suma_impuestos:             ${COP(ventaMontoTotal + sumaImpuestos)}`)
  console.log(`  + anuladas + impuestos:       ${COP(ventaMontoTotal + anuladasTotal + impuestos)}`)

  if (target !== null) {
    const diff = target - ventaMontoTotal
    printHeader('COMPARACIÓN CONTRA TARGET')
    console.log(`  POS reportado:        ${COP(target)}`)
    console.log(`  BusinessHub:          ${COP(ventaMontoTotal)}`)
    console.log(`  Diferencia:           ${COP(diff)}   (${((diff / target) * 100).toFixed(3)}%)`)
    if (Math.abs(diff) < 1) console.log('  OK ✅  Cuadra 1:1')
    else console.log('  ⚠️  NO cuadra — revisar distribuciones abajo')
  }

  return { ventaMontoTotal, validCount }
}

function reportByDay(ventas) {
  const map = new Map()
  for (const v of ventas) {
    const d = (v.fecha || '').slice(0, 10)
    if (!d) continue
    const row = map.get(d) || { count: 0, total: 0, propinas: 0, envio: 0, anuladas: 0, montoAnul: 0 }
    if (isAnuladaStrict(v)) {
      row.anuladas++
      row.montoAnul += ventaMontoCanonical(v)
    } else {
      row.count++
      row.total += num(v.total)
      row.propinas += sumPropinasCanonical(v)
      row.envio += num(v.costoenvio)
    }
    map.set(d, row)
  }
  printHeader('DESGLOSE POR DÍA')
  console.log('  ' + pad('Fecha', 12) + padR('#', 5) + padR('Neto', 18) + padR('Propinas', 14) + padR('Envío', 14) + padR('Subtotal', 18) + padR('#Anul', 7))
  printRule()
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  let grand = 0
  for (const [d, r] of sorted) {
    const sub = r.total + r.propinas + r.envio
    grand += sub
    console.log('  ' + pad(d, 12) + padR(r.count, 5) + padR(COP(r.total), 18) + padR(COP(r.propinas), 14) + padR(COP(r.envio), 14) + padR(COP(sub), 18) + padR(r.anuladas, 7))
  }
  printRule()
  console.log('  ' + pad('TOTAL', 12 + 5) + padR('', 18 + 14 + 14) + padR(COP(grand), 18))
}

function reportByKey(ventas, keyFn, title) {
  const map = new Map()
  for (const v of ventas) {
    if (isAnuladaStrict(v)) continue
    const k = keyFn(v)
    const row = map.get(k) || { count: 0, total: 0, propinas: 0, envio: 0 }
    row.count++
    row.total += num(v.total)
    row.propinas += sumPropinasCanonical(v)
    row.envio += num(v.costoenvio)
    map.set(k, row)
  }
  printHeader(title)
  console.log('  ' + pad('Clave', 20) + padR('#', 6) + padR('Neto', 18) + padR('Propinas', 14) + padR('Envío', 14) + padR('Subtotal', 18))
  printRule()
  const rows = [...map.entries()].sort((a, b) => (b[1].total + b[1].propinas + b[1].envio) - (a[1].total + a[1].propinas + a[1].envio))
  for (const [k, r] of rows) {
    const sub = r.total + r.propinas + r.envio
    console.log('  ' + pad(k, 20) + padR(r.count, 6) + padR(COP(r.total), 18) + padR(COP(r.propinas), 14) + padR(COP(r.envio), 14) + padR(COP(sub), 18))
  }
}

function reportEstados(ventas) {
  const map = new Map()
  for (const v of ventas) {
    const k = String(v.estado_txt || '(vacío)')
    const row = map.get(k) || { count: 0, monto: 0 }
    row.count++
    row.monto += ventaMontoCanonical(v)
    map.set(k, row)
  }
  printHeader('DISTRIBUCIÓN DE estado_txt (importante para detectar anuladas mal etiquetadas)')
  console.log('  ' + pad('estado_txt', 40) + padR('#', 6) + padR('Monto', 20))
  printRule()
  const rows = [...map.entries()].sort((a, b) => b[1].monto - a[1].monto)
  for (const [k, r] of rows) {
    const flag = k.toLowerCase().includes('anul') && k.toLowerCase() !== 'comprobante anulado' ? ' ⚠️' : ''
    console.log('  ' + pad(k, 40) + padR(r.count, 6) + padR(COP(r.monto), 20) + flag)
  }
}

function reportPagosList(ventas) {
  const map = new Map()
  const noPropinaSuspicious = new Map()
  for (const v of ventas) {
    if (isAnuladaStrict(v)) continue
    for (const p of v.pagosList || []) {
      const tipo = String(p.tipoPago ?? p.pagoventa_tipo ?? '(vacío)')
      const monto = num(p.monto ?? p.pagoventa_monto)
      const row = map.get(tipo) || { count: 0, monto: 0 }
      row.count++
      row.monto += monto
      map.set(tipo, row)

      const tl = tipo.toLowerCase()
      const isPropinaLike = tl.includes('propina') || tl.includes('tip')
      const looksLikeService = tl.includes('servici') || tl.includes('voluntari') || tl.includes('recargo') || tl.includes('10%') || tl.includes('consumo')
      if (!isPropinaLike && looksLikeService) {
        const r = noPropinaSuspicious.get(tipo) || { count: 0, monto: 0 }
        r.count++
        r.monto += monto
        noPropinaSuspicious.set(tipo, r)
      }
    }
  }

  printHeader('DISTRIBUCIÓN DE pagosList[].tipoPago (clave para propinas perdidas)')
  console.log('  ' + pad('tipoPago / pagoventa_tipo', 40) + padR('#', 6) + padR('Monto', 20) + '  flag')
  printRule()
  const rows = [...map.entries()].sort((a, b) => b[1].monto - a[1].monto)
  for (const [k, r] of rows) {
    const tl = k.toLowerCase()
    const isPropinaLike = tl.includes('propina') || tl.includes('tip')
    const looksLikeService = tl.includes('servici') || tl.includes('voluntari') || tl.includes('recargo') || tl.includes('10%') || tl.includes('consumo')
    const flag = isPropinaLike ? '  ✓ cuenta como propina' : looksLikeService ? '  ⚠️ parece propina pero NO cuenta' : ''
    console.log('  ' + pad(k, 40) + padR(r.count, 6) + padR(COP(r.monto), 20) + flag)
  }

  if (noPropinaSuspicious.size > 0) {
    printHeader('🚨 SOSPECHOSAS (pagos "servicio/recargo/voluntario" no contados como propina)')
    let sumSosp = 0
    for (const [k, r] of noPropinaSuspicious) {
      console.log(`  ${pad(k, 40)} ${padR(r.count, 6)} ${padR(COP(r.monto), 20)}`)
      sumSosp += r.monto
    }
    console.log(`  ${pad('Σ sospechosas:', 40 + 6)} ${padR(COP(sumSosp), 20)}`)
  }
}

function reportDocsSummary(docs) {
  printHeader('DOCUMENTOS DEL CACHE (date_localId)')
  console.log(`  Total docs en rango: ${docs.length}`)
  // detectar días con count 0 o anomalías
  const byDate = new Map()
  for (const d of docs) {
    const row = byDate.get(d.date) || { locals: new Set(), total: 0 }
    row.locals.add(d.localId)
    row.total += d.count
    byDate.set(d.date, row)
  }
  const sorted = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  for (const [date, r] of sorted) {
    console.log(`  ${date}  locales=${[...r.locals].sort((a, b) => a - b).join(',')}  ventas=${r.total}`)
  }
}

// ───────── Main ─────────
async function main() {
  if (!companyId) {
    console.log('Empresas disponibles en Firestore (proyecto:', PROJECT_ID + ')')
    printRule()
    const cos = await listCompanies()
    for (const c of cos) {
      // total rápido del mes actual
      let totalMes = 0
      let count = 0
      try {
        const { ventas } = await loadVentas(c.id, mr.from, mr.monthEnd)
        for (const v of ventas) {
          if (!isAnuladaStrict(v)) {
            totalMes += ventaMontoCanonical(v)
            count++
          }
        }
      } catch {}
      console.log(`  ${pad(c.id, 28)} ${pad(c.name, 30)} ${pad(c.location, 20)} ventas=${count}  ${COP(totalMes)}`)
    }
    console.log('')
    console.log('Corre: node scripts/audit-pos-sales.mjs --company <id> --target 130868935')
    process.exit(0)
  }

  console.log(`Proyecto:  ${PROJECT_ID}`)
  console.log(`Empresa:   ${companyId}`)
  console.log(`Rango:     ${fromDate}  →  ${toDate}`)
  if (target !== null) console.log(`Target POS: ${COP(target)}`)

  const { ventas, docs } = await loadVentas(companyId, fromDate, toDate)
  console.log(`Ventas cargadas del cache: ${ventas.length} (${docs.length} documentos)`)

  const source = args.source || 'cache'
  let ventasForReport = ventas

  if (source === 'live' || source === 'both') {
    // Deducir locales del cache
    const localIds = [...new Set(ventas.map((v) => v.id_local).filter((x) => x != null))]
    // Si no hay ninguno en cache, intentar con los comunes 1-5
    const probeIds = localIds.length > 0 ? localIds : [1, 2, 3, 4, 5]
    console.log(`\nFetch LIVE via proxy para locales=${probeIds.join(',')}`)
    const live = await fetchLiveVentas(probeIds, fromDate, toDate)
    console.log(`Ventas live: ${live.ventas.length} (rateLimited=${live.rateLimited})`)

    if (source === 'live') {
      ventasForReport = live.ventas
    } else {
      // DIFF cache vs live
      const cacheIds = new Set(ventas.map((v) => String(v.ID)))
      const liveIds = new Set(live.ventas.map((v) => String(v.ID)))
      const onlyLive = live.ventas.filter((v) => !cacheIds.has(String(v.ID)))
      const onlyCache = ventas.filter((v) => !liveIds.has(String(v.ID)))
      printHeader('DIFF cache vs live')
      console.log(`  En live pero NO en cache: ${onlyLive.length}  ventaMonto=${COP(onlyLive.reduce((s, v) => s + (isAnuladaStrict(v) ? 0 : ventaMontoCanonical(v)), 0))}`)
      console.log(`  En cache pero NO en live: ${onlyCache.length}  ventaMonto=${COP(onlyCache.reduce((s, v) => s + (isAnuladaStrict(v) ? 0 : ventaMontoCanonical(v)), 0))}`)
      if (onlyLive.length > 0 && onlyLive.length <= 20) {
        console.log('  IDs en live no cacheadas:')
        for (const v of onlyLive) {
          console.log(`    ${v.ID}  ${v.fecha}  local=${v.id_local}  total=${COP(num(v.total))}  prop=${COP(sumPropinasCanonical(v))}  estado=${v.estado_txt}`)
        }
      }
      if (onlyCache.length > 0 && onlyCache.length <= 20) {
        console.log('  IDs en cache no en live:')
        for (const v of onlyCache) {
          console.log(`    ${v.ID}  ${v.fecha}  local=${v.id_local}  total=${COP(num(v.total))}  prop=${COP(sumPropinasCanonical(v))}  estado=${v.estado_txt}`)
        }
      }
      ventasForReport = live.ventas
      console.log('\nA continuación el reporte usa ventas LIVE (proxy → POS directo):')
    }
  }

  reportTotals(ventasForReport)
  reportByDay(ventasForReport)
  reportByKey(ventasForReport, (v) => String(v.id_local ?? '?'), 'DESGLOSE POR id_local')
  reportByKey(ventasForReport, (v) => String(v.caja_id ?? '?'), 'DESGLOSE POR caja_id')
  reportByKey(ventasForReport, (v) => String(v.tipo_documento ?? '?'), 'DESGLOSE POR tipo_documento')
  reportEstados(ventasForReport)
  reportPagosList(ventasForReport)
  if (source === 'cache') reportDocsSummary(docs)
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  if (err.code === 16 || err.message.includes('UNAUTHENTICATED')) {
    console.error('')
    console.error('Autenticación fallida. Corre: gcloud auth application-default login')
  }
  process.exit(1)
})
