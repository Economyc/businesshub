// Conciliación profesional POS↔Credibanco — Blue Smash Brgr Manila.
// Uso: node scripts/recon-pro-manila.mjs <YYYY-MM-DD> <ruta-csv> [<cierre-efectivo>]

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const FECHA = process.argv[2]
const CSV = process.argv[3]
const CIERRE_EFECTIVO_DECLARADO = process.argv[4] != null ? Number(String(process.argv[4]).replace(/[$.\s,]/g, '')) : null
if (!FECHA || !CSV) { console.error('Uso: <YYYY-MM-DD> <csv> [<cierre-efectivo>]'); process.exit(1) }

const TOKEN = execSync('gcloud secrets versions access latest --secret=POS_TOKEN --project=empresas-bf', { encoding: 'utf-8' }).trim()
const url = `http://api.restaurant.pe/restaurant/readonly/rest/venta/obtenerVentasPorIntegracion/8267?token=${TOKEN}`

const delay = (ms) => new Promise((x) => setTimeout(x, ms))
const num = (v) => Number(String(v ?? '').replace(/[$.\s]/g, '').replace(/,/g, '.')) || 0
const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO')
const sumProp = (v) => (v.lista_propinas ?? []).reduce((s, p) => s + (Number(p.montoConIgv) || 0), 0)
const isAnulada = (v) => (v.estado_txt || '').toLowerCase() === 'comprobante anulado'
const isCash = (s) => { const t = String(s ?? '').toLowerCase(); return t.includes('efectivo') || t.includes('cash') }

// Suma efectivo de una venta considerando pagos mixtos (pagosList) + propinas en efectivo
function efectivoDeVenta(v) {
  const total = Number(v.total) || 0
  const pagos = Array.isArray(v.pagosList) ? v.pagosList : []
  let cashFromPagos = 0
  if (pagos.length === 0) {
    cashFromPagos = 0
  } else if (pagos.length === 1) {
    cashFromPagos = isCash(pagos[0].pagoventa_tipo) ? total : 0
  } else {
    // pago mixto: distribuir por monto explícito de cada entrada
    for (const p of pagos) {
      const monto = Number(p.monto ?? p.montoConIgv ?? p.importe) || 0
      if (isCash(p.pagoventa_tipo)) cashFromPagos += monto
    }
  }
  // propinas en efectivo (pueden venir aunque el pago principal sea tarjeta)
  let cashFromPropinas = 0
  for (const p of (v.lista_propinas ?? [])) {
    if (isCash(p.tipoPago)) cashFromPropinas += Number(p.montoConIgv) || 0
  }
  return cashFromPagos + cashFromPropinas
}

async function fetchAll() {
  const all = []
  let pagina = 1
  while (true) {
    let json = null
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt > 0) await delay(15000)
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ local_id: 1, f1: `${FECHA} 00:00:00`, f2: `${FECHA} 23:59:59`, pagina, incluirNotasVenta: 1 }),
      })
      json = await r.json()
      const msg = (json.mensajes || []).join(' ').toLowerCase()
      if (msg.includes('solicitud en ejecuci') || msg.includes('esper')) continue
      break
    }
    if (Number(json?.tipo) !== 1) break
    const page = Array.isArray(json.data) ? json.data : Object.values(json.data || {})
    if (page.length === 0) break
    all.push(...page); pagina++; await delay(7000)
  }
  return all
}

function parseCSV() {
  const txt = readFileSync(CSV, 'utf-8')
  const lines = txt.split(/\r?\n/).filter(Boolean); lines.shift()
  const out = []
  for (const ln of lines) {
    const c = ln.split(';').map((x) => x.replace(/^"|"$/g, ''))
    if (c[14] === 'TOTAL' || !c[3]) continue
    out.push({
      hora: c[3], horaHM: c[3].slice(11, 16), horaSec: c[3].slice(11),
      terminal: c[4], id: c[5], numTarjeta: c[8], franq: c[9], tipoProducto: c[10],
      autorizacion: c[13], idCajero: c[14],
      valorCompra: num(c[15]), propina: num(c[18]), compraNeta: num(c[19]),
      tier: null, matchedVentaId: null, categoria: null,
    })
  }
  return out
}

function runMatcher(ventas, vouchers) {
  const ventasPool = ventas.filter((v) => !isAnulada(v)).map((v) => ({
    v, total: Number(v.total), propina: sumProp(v),
    hora: v.fecha?.slice(11, 16), matched: false, tier: null, vouchers: [],
  }))

  const horaDiff = (a, b) => {
    if (!a || !b) return 999
    const [ha, ma] = a.split(':').map(Number); const [hb, mb] = b.split(':').map(Number)
    return Math.abs((ha * 60 + ma) - (hb * 60 + mb))
  }
  const isVentaTarjeta = (vp) => {
    const tipo = String(vp.v.pagosList?.[0]?.pagoventa_tipo || '').toLowerCase()
    return tipo.includes('tarjeta') || tipo.includes('card')
  }

  // T1
  for (const vc of vouchers) {
    const cand = ventasPool.find((vp) => !vp.matched &&
      Math.abs(vp.total - vc.compraNeta) < 1 && Math.abs(vp.propina - vc.propina) < 1 &&
      horaDiff(vp.hora, vc.horaHM) <= 10)
    if (cand) { vc.tier = 'T1'; vc.matchedVentaId = cand.v.ID; cand.matched = true; cand.tier = 'T1'; cand.vouchers.push(vc) }
  }
  for (const vc of vouchers) {
    if (vc.tier) continue
    const cand = ventasPool.find((vp) => !vp.matched &&
      Math.abs(vp.total - vc.compraNeta) < 1 && Math.abs(vp.propina - vc.propina) < 1)
    if (cand) { vc.tier = 'T1'; vc.matchedVentaId = cand.v.ID; cand.matched = true; cand.tier = 'T1'; cand.vouchers.push(vc) }
  }

  // T2 splits 2/3/4
  for (const vp of ventasPool) {
    if (vp.matched) continue
    const targetBruto = vp.total + vp.propina
    const u = vouchers.filter((x) => !x.tier)
    let found = false
    for (let i = 0; i < u.length && !found; i++) for (let j = i + 1; j < u.length && !found; j++) {
      if (Math.abs((u[i].valorCompra + u[j].valorCompra) - targetBruto) < 100 && horaDiff(u[i].horaHM, vp.hora) <= 30) {
        u[i].tier = u[j].tier = 'T2'; u[i].matchedVentaId = u[j].matchedVentaId = vp.v.ID
        vp.matched = true; vp.tier = 'T2'; vp.vouchers.push(u[i], u[j]); found = true
      }
    }
    if (found) continue
    for (let i = 0; i < u.length && !found; i++) { if (u[i].tier) continue
      for (let j = i + 1; j < u.length && !found; j++) { if (u[j].tier) continue
        for (let k = j + 1; k < u.length && !found; k++) { if (u[k].tier) continue
          if (Math.abs((u[i].valorCompra + u[j].valorCompra + u[k].valorCompra) - targetBruto) < 100 && horaDiff(u[i].horaHM, vp.hora) <= 30) {
            u[i].tier = u[j].tier = u[k].tier = 'T2'
            u[i].matchedVentaId = u[j].matchedVentaId = u[k].matchedVentaId = vp.v.ID
            vp.matched = true; vp.tier = 'T2'; vp.vouchers.push(u[i], u[j], u[k]); found = true
          }
        }
      }
    }
    if (found) continue
    for (let i = 0; i < u.length && !found; i++) { if (u[i].tier) continue
      for (let j = i + 1; j < u.length && !found; j++) { if (u[j].tier) continue
        for (let k = j + 1; k < u.length && !found; k++) { if (u[k].tier) continue
          for (let l = k + 1; l < u.length && !found; l++) { if (u[l].tier) continue
            if (Math.abs((u[i].valorCompra + u[j].valorCompra + u[k].valorCompra + u[l].valorCompra) - targetBruto) < 100 && horaDiff(u[i].horaHM, vp.hora) <= 30) {
              u[i].tier = u[j].tier = u[k].tier = u[l].tier = 'T2'
              u[i].matchedVentaId = u[j].matchedVentaId = u[k].matchedVentaId = u[l].matchedVentaId = vp.v.ID
              vp.matched = true; vp.tier = 'T2'; vp.vouchers.push(u[i], u[j], u[k], u[l]); found = true
            }
          }
        }
      }
    }
    if (found) continue
    // Splits de 5-8 vouchers (mesas grandes / eventos / menús grupales)
    // Estrategia greedy: ordena por hora cercana, prueba subset incremental
    const cercanos = u.filter((x) => !x.tier && horaDiff(x.horaHM, vp.hora) <= 30)
      .sort((a, b) => horaDiff(a.horaHM, vp.hora) - horaDiff(b.horaHM, vp.hora))
    for (let nVouchers = 5; nVouchers <= 8 && !found; nVouchers++) {
      if (cercanos.length < nVouchers) break
      // Intentar combinaciones por proximidad temporal
      const combo = cercanos.slice(0, nVouchers)
      const sumCombo = combo.reduce((s, x) => s + x.valorCompra, 0)
      if (Math.abs(sumCombo - targetBruto) < 200) {
        for (const x of combo) { x.tier = 'T2'; x.matchedVentaId = vp.v.ID }
        vp.matched = true; vp.tier = 'T2'; vp.vouchers.push(...combo); found = true
      }
    }
  }

  // T3 tip variance
  for (const vc of vouchers) {
    if (vc.tier) continue
    const cand = ventasPool.find((vp) => !vp.matched && Math.abs(vp.total - vc.compraNeta) < 1 &&
      vp.propina > 0 && Math.abs(vp.propina - vc.propina) / Math.max(vp.propina, 1) <= 0.15)
    if (cand) { vc.tier = 'T3'; vc.matchedVentaId = cand.v.ID; cand.matched = true; cand.tier = 'T3'; cand.vouchers.push(vc) }
  }
  // T4 time slip (solo Tarjeta)
  for (const vc of vouchers) {
    if (vc.tier) continue
    const cand = ventasPool.find((vp) => !vp.matched && isVentaTarjeta(vp) && Math.abs(vp.total - vc.compraNeta) < 1)
    if (cand) { vc.tier = 'T4'; vc.matchedVentaId = cand.v.ID; cand.matched = true; cand.tier = 'T4'; cand.vouchers.push(vc) }
  }
  // T5 ±1% (solo Tarjeta)
  for (const vc of vouchers) {
    if (vc.tier) continue
    const cand = ventasPool.find((vp) => !vp.matched && isVentaTarjeta(vp) &&
      Math.abs(vp.total - vc.compraNeta) / Math.max(vp.total, 1) <= 0.01)
    if (cand) { vc.tier = 'T5'; vc.matchedVentaId = cand.v.ID; cand.matched = true; cand.tier = 'T5'; cand.vouchers.push(vc) }
  }

  return { ventasPool }
}

function clasificar(ventasPool, vouchers) {
  const residuosV = vouchers.filter((v) => !v.tier)
  const residuosVP = ventasPool.filter((vp) => !vp.matched)

  const byKey = new Map()
  for (const vc of residuosV) {
    const k = `${vc.valorCompra}`
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k).push(vc)
  }
  for (const [, group] of byKey) {
    if (group.length < 2) continue
    group.sort((a, b) => a.horaSec.localeCompare(b.horaSec))
    for (let i = 1; i < group.length; i++) {
      const p = group[i - 1].horaSec.split(':').map(Number)
      const c = group[i].horaSec.split(':').map(Number)
      const dt = (c[0] * 3600 + c[1] * 60 + c[2]) - (p[0] * 3600 + p[1] * 60 + p[2])
      // Solo D-DUP si MISMA tarjeta (mismos últimos 4) en ≤60s. Tarjetas
      // distintas con mismo monto = mesa grande/menú grupal, NO duplicado.
      if (dt <= 60 && group[i - 1].numTarjeta === group[i].numTarjeta) {
        if (!group[i - 1].categoria) group[i - 1].categoria = 'D-DUP'
        group[i].categoria = 'D-DUP'
      }
    }
  }
  for (const vc of residuosV) if (!vc.categoria) vc.categoria = 'D-PHA'
  for (const vp of residuosVP) {
    const tipo = String(vp.v.pagosList?.[0]?.pagoventa_tipo || '').toLowerCase()
    vp.categoria = (tipo.includes('tarjeta') || tipo.includes('card')) ? 'D-MIS' :
                   (tipo.includes('efectivo') || tipo.includes('cash')) ? 'D-CSH' : 'D-MIS'
  }
  return { residuosV, residuosVP }
}

function forense(vouchers) {
  const r = { porTerminal: {}, porFranq: {}, heatmap: {}, repetidos: [], medianoche: 0 }
  for (const vc of vouchers) {
    const t = vc.terminal || '?'
    if (!r.porTerminal[t]) r.porTerminal[t] = { count: 0, monto: 0, dPha: 0, dDup: 0 }
    r.porTerminal[t].count++; r.porTerminal[t].monto += vc.valorCompra
    if (vc.categoria === 'D-PHA') r.porTerminal[t].dPha++
    if (vc.categoria === 'D-DUP') r.porTerminal[t].dDup++
    const f = vc.franq || '?'
    if (!r.porFranq[f]) r.porFranq[f] = { count: 0, monto: 0, problemas: 0 }
    r.porFranq[f].count++; r.porFranq[f].monto += vc.valorCompra
    if (vc.categoria) r.porFranq[f].problemas++
    const [h, m] = vc.horaHM.split(':').map(Number)
    const b = `${String(h).padStart(2, '0')}:${m < 30 ? '00' : '30'}`
    if (!r.heatmap[b]) r.heatmap[b] = { ok: 0, problema: 0 }
    if (vc.categoria) r.heatmap[b].problema++; else r.heatmap[b].ok++
    if (vc.horaHM >= '22:00') r.medianoche++
  }
  const grouping = new Map()
  for (const vc of vouchers) {
    if (!grouping.has(vc.valorCompra)) grouping.set(vc.valorCompra, [])
    grouping.get(vc.valorCompra).push(vc)
  }
  for (const [monto, list] of grouping) {
    if (list.length < 3) continue
    list.sort((a, b) => a.horaSec.localeCompare(b.horaSec))
    const toSec = (s) => { const [h, m, sc] = s.split(':').map(Number); return h * 3600 + m * 60 + sc }
    const span = toSec(list[list.length - 1].horaSec) - toSec(list[0].horaSec)
    if (span < 600) r.repetidos.push({ monto, count: list.length, spanSec: span, auths: list.map((x) => x.autorizacion) })
  }
  return r
}

const ventas = await fetchAll()
const vouchers = parseCSV()
const { ventasPool } = runMatcher(ventas, vouchers)
const { residuosV, residuosVP } = clasificar(ventasPool, vouchers)
const f = forense(vouchers)

const ventasActivas = ventas.filter((v) => !isAnulada(v))
const totalPOSneto = ventasActivas.reduce((s, v) => s + Number(v.total), 0)
const totalPOSprop = ventasActivas.reduce((s, v) => s + sumProp(v), 0)
const totalCSVbruto = vouchers.reduce((s, v) => s + v.valorCompra, 0)

const phas = residuosV.filter((v) => v.categoria === 'D-PHA')
const dups = residuosV.filter((v) => v.categoria === 'D-DUP')
const mis = residuosVP.filter((vp) => vp.categoria === 'D-MIS')
const csh = residuosVP.filter((vp) => vp.categoria === 'D-CSH')
const dPhaTot = phas.reduce((s, p) => s + p.valorCompra, 0)
const dDupTot = dups.reduce((s, d) => s + d.valorCompra, 0)
const dMisTot = mis.reduce((s, m) => s + m.total + m.propina, 0)
const dCshTot = csh.reduce((s, c) => s + c.total + c.propina, 0)
const cuadre = totalPOSneto + totalPOSprop - dCshTot - dMisTot + dPhaTot + dDupTot
const delta = cuadre - totalCSVbruto
const probMonto = dPhaTot + dDupTot + dMisTot
const probPct = (probMonto / Math.max(totalCSVbruto, 1)) * 100
let semaforo = '🟢 VERDE'; if (probPct > 5) semaforo = '🟡 AMARILLO'; if (probPct > 10 || dups.length > 0) semaforo = '🔴 ROJO'

console.log('═'.repeat(80))
console.log(`  CONCILIACIÓN PROFESIONAL — Manila ${FECHA}`)
console.log('═'.repeat(80))
console.log(`\n► UNIVERSO`)
console.log(`  POS: ${ventasActivas.length} ventas | bruto ${fmt(totalPOSneto + totalPOSprop)}`)
console.log(`  Credibanco: ${vouchers.length} vouchers | bruto ${fmt(totalCSVbruto)}`)

console.log(`\n► MATCHING JERÁRQUICO`)
const tc = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0, R: 0 }
for (const vc of vouchers) tc[vc.tier || 'R']++
for (const t of ['T1', 'T2', 'T3', 'T4', 'T5', 'R']) console.log(`  ${t}: ${tc[t]} vouchers`)

console.log(`\n► TAXONOMÍA DE DISCREPANCIAS`)
const cats = { 'D-PHA': [phas.length, dPhaTot, '⚠️  Phantom (cobro sin venta)'], 'D-DUP': [dups.length, dDupTot, '🚨 Duplicado'], 'D-MIS': [mis.length, dMisTot, '⚠️  Missing acquirer (POS Tarjeta sin voucher)'], 'D-CSH': [csh.length, dCshTot, '   Efectivo legítimo'] }
for (const [k, [n, m, l]] of Object.entries(cats)) if (n) console.log(`  ${k}: ${n} × ${fmt(m)}  ${l}`)

if (dups.length > 0) { console.log(`\n  D-DUP detalle:`); for (const d of dups) console.log(`    ${d.horaSec} ${d.franq.padEnd(10)} ${d.numTarjeta} auth=${d.autorizacion} ${fmt(d.valorCompra)}`) }
if (phas.length > 0) { console.log(`\n  D-PHA detalle:`); for (const p of phas) console.log(`    ${p.horaSec} term=${p.terminal} ${p.franq.padEnd(10)} auth=${p.autorizacion.padEnd(8)} ${fmt(p.valorCompra)}`) }
if (mis.length > 0) { console.log(`\n  D-MIS detalle:`); for (const m of mis) console.log(`    ${m.v.fecha?.slice(11, 16)} ${m.v.tipo_documento || 'NV'} ${m.v.serie}-${m.v.correlativo} total=${fmt(m.total)} pago=${m.v.pagosList?.[0]?.pagoventa_tipo || '?'}`) }

console.log(`\n► FORENSE — POR TERMINAL`)
for (const [t, s] of Object.entries(f.porTerminal)) {
  const flag = (s.dPha + s.dDup) > 0 ? '⚠️' : '✓'
  console.log(`  ${flag} ${t}: ${s.count} vouchers, ${fmt(s.monto)} | D-PHA=${s.dPha} D-DUP=${s.dDup}`)
}
console.log(`\n► FORENSE — POR FRANQUICIA`)
for (const [fr, s] of Object.entries(f.porFranq)) {
  const tasa = ((s.problemas / s.count) * 100).toFixed(1)
  console.log(`  ${fr.padEnd(12)}: ${s.count} | problemas=${s.problemas} (${tasa}%)`)
}
console.log(`\n► PATRONES DE REPETICIÓN (mismo monto en <10min):`)
if (f.repetidos.length === 0) console.log('  ✓ Ninguno')
else for (const r of f.repetidos) console.log(`  ⚠️  ${fmt(r.monto)} × ${r.count} en ${r.spanSec}s | auths: ${r.auths.join(', ')}`)

// ► EFECTIVO — comparar POS efectivo vs cierre físico declarado
const totalPOSefectivo = ventasActivas.reduce((s, v) => s + efectivoDeVenta(v), 0)
let deltaEfectivo = null
let semaforoEfectivo = null
if (CIERRE_EFECTIVO_DECLARADO != null) {
  deltaEfectivo = totalPOSefectivo - CIERRE_EFECTIVO_DECLARADO
  const absPct = Math.abs(deltaEfectivo) / Math.max(totalPOSefectivo, 1) * 100
  semaforoEfectivo = '🟢 OK'
  if (absPct > 2) semaforoEfectivo = '🟡 REVISAR'
  if (absPct > 5 || Math.abs(deltaEfectivo) >= 50000) semaforoEfectivo = '🔴 FUGA'
  console.log(`\n► EFECTIVO`)
  console.log(`  POS efectivo (ventas + propinas cash) = ${fmt(totalPOSefectivo)}`)
  console.log(`  Cierre declarado                       = ${fmt(CIERRE_EFECTIVO_DECLARADO)}`)
  console.log(`  Δ efectivo = POS - declarado          = ${fmt(deltaEfectivo)}  ${semaforoEfectivo}`)
  if (deltaEfectivo > 0) console.log(`  → POS registró más cash del que apareció en caja: posible faltante / no entregado`)
  else if (deltaEfectivo < 0) console.log(`  → Aparece más cash en caja del que registró el POS: ventas no facturadas o conteo erróneo`)
  else console.log(`  → Cash cuadra exacto`)
}

console.log(`\n► CUADRE`)
console.log(`  POS bruto - D-CSH - D-MIS + D-PHA + D-DUP = ${fmt(cuadre)}`)
console.log(`  Credibanco real = ${fmt(totalCSVbruto)}`)
console.log(`  Δ residual = ${fmt(delta)}`)
console.log(`\n  SEMÁFORO: ${semaforo}  (${probPct.toFixed(1)}% del bruto en discrepancias)`)

console.log(`\n[JSON]`)
console.log(JSON.stringify({ fecha: FECHA, ventasPOS: ventasActivas.length, vouchers: vouchers.length, posBruto: totalPOSneto + totalPOSprop, csvBruto: totalCSVbruto, tier: tc, semaforo, probPct, dPhaCount: phas.length, dPhaMonto: dPhaTot, dDupCount: dups.length, dDupMonto: dDupTot, dMisCount: mis.length, dMisMonto: dMisTot, deltaResidual: delta, porTerminal: f.porTerminal, porFranq: f.porFranq, posEfectivo: totalPOSefectivo, cierreDeclarado: CIERRE_EFECTIVO_DECLARADO, deltaEfectivo, semaforoEfectivo }))
