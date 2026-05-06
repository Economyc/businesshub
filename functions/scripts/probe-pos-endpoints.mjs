// Sondeo rápido para descubrir endpoints de cierres/arqueos en restaurant.pe.
// Uso: node functions/scripts/probe-pos-endpoints.mjs
// Imprime: endpoint | http_status | tipo | mensaje | hint

import { execSync } from 'node:child_process'

const TOKEN = execSync('gcloud secrets versions access latest --secret=POS_TOKEN --project=empresas-bf', { encoding: 'utf-8' }).trim()
const DOMAIN = '8267'
const BASE = 'http://api.restaurant.pe/restaurant/readonly/rest'

// Endpoint candidates ordered by likelihood
const PATHS = [
  // /caja/*
  'caja/obtenerCierreCaja',
  'caja/obtenerCierresCaja',
  'caja/obtenerCierres',
  'caja/obtenerCierresPorIntegracion',
  'caja/obtenerArqueo',
  'caja/obtenerArqueos',
  'caja/obtenerArqueoCaja',
  'caja/obtenerArqueosPorIntegracion',
  'caja/obtenerCajas',
  'caja/obtenerCajasPorIntegracion',
  'caja/obtenerCierreDelDia',
  'caja/obtenerCierresDelLocal',
  'caja/obtenerCierresPorLocal',
  'caja/obtenerCuadre',
  'caja/obtenerCuadreCaja',
  // /cierre/*
  'cierre/obtenerCierres',
  'cierre/obtenerCierresPorIntegracion',
  'cierre/obtener',
  // /arqueo/*
  'arqueo/obtenerArqueos',
  'arqueo/obtenerArqueosPorIntegracion',
  'arqueo/obtener',
  // /venta/* (mismo namespace que ventas)
  'venta/obtenerCierres',
  'venta/obtenerCierresPorIntegracion',
  'venta/obtenerArqueos',
  'venta/obtenerArqueosPorIntegracion',
  'venta/obtenerCierreCaja',
  // /turno/*
  'turno/obtenerCierres',
  'turno/obtenerTurnos',
  'turno/obtenerCierresPorIntegracion',
  // /reporte/*
  'reporte/obtenerCierres',
  'reporte/obtenerCierreCaja',
  'reporte/obtenerArqueos',
]

const HOY = '2026-05-04'  // ayer (hoy quizá no tiene cierre aún)

const body = {
  local_id: 1,
  f1: `${HOY} 00:00:00`,
  f2: `${HOY} 23:59:59`,
  pagina: 1,
}

async function probe(path) {
  const url = `${BASE}/${path}/${DOMAIN}?token=${TOKEN}`
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await r.text()
    let json
    try { json = JSON.parse(text) } catch { json = null }
    const tipo = json?.tipo
    const msgs = (json?.mensajes ?? []).join(' | ').slice(0, 100)
    const dataKind = Array.isArray(json?.data)
      ? `array[${json.data.length}]`
      : json?.data && typeof json.data === 'object'
        ? `obj{${Object.keys(json.data).slice(0, 3).join(',')}}`
        : typeof json?.data
    const hint = (() => {
      if (!json) return text.slice(0, 80)
      if (Number(tipo) === 1) return '✅ HIT (tipo=1)'
      if (msgs.toLowerCase().includes('no existe')) return 'method not found'
      if (msgs.toLowerCase().includes('no encontrad')) return 'method not found'
      if (msgs.toLowerCase().includes('parámetro')) return '⚠️  endpoint exists but bad params'
      if (msgs.toLowerCase().includes('parametro')) return '⚠️  endpoint exists but bad params'
      if (msgs.toLowerCase().includes('local')) return '⚠️  endpoint exists, local_id issue'
      return ''
    })()
    return { path, status: r.status, tipo, dataKind, msgs, hint }
  } catch (e) {
    return { path, status: 'ERR', tipo: '-', dataKind: '-', msgs: String(e).slice(0, 100), hint: 'network error' }
  }
}

console.log('Probing restaurant.pe endpoints...\n')
console.log('endpoint'.padEnd(50), 'tipo'.padEnd(6), 'data'.padEnd(20), 'hint')
console.log('-'.repeat(120))

const hits = []
for (const path of PATHS) {
  const r = await probe(path)
  console.log(
    String(path).padEnd(50),
    String(r.tipo).padEnd(6),
    String(r.dataKind ?? '-').padEnd(20),
    r.hint || (r.msgs ? r.msgs.slice(0, 60) : '')
  )
  if (Number(r.tipo) === 1 || r.hint?.includes('endpoint exists')) {
    hits.push({ ...r, fullMsg: r.msgs })
  }
  // throttle ligero para no rate-limitar
  await new Promise((x) => setTimeout(x, 600))
}

console.log('\n' + '='.repeat(60))
if (hits.length === 0) {
  console.log('❌ Ningún endpoint candidato respondió. El POS de restaurant.pe NO expone (públicamente) un endpoint de cierres/arqueos por estas rutas.')
} else {
  console.log('🎯 Hits / candidatos:')
  for (const h of hits) console.log('  -', h.path, 'tipo=', h.tipo, 'msg=', h.fullMsg)
}
