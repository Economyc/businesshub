// Genera un PDF de resumen ejecutivo de ventas (Abril y Mayo 2026) para la
// sede Escondite de Blue Smash Burger. Lee del POS via el proxy publico
// (tenantId 'blue', sin credenciales) y renderiza con Playwright/Chromium.
// Uso: node scripts/blue-escondite-resumen.mjs

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { chromium } from 'playwright'

const PROXY_URL = 'https://posproxy-xfyucmyk7q-uc.a.run.app/'
const TENANT_ID = 'blue'
const OUT_PATH = join(homedir(), 'Downloads', 'Resumen Blue Smash Burger Escondite Abril Mayo 2026.pdf')

const MONTHS = [
  { key: 'abril', label: 'Abril', f1: '2026-04-01 00:00:00', f2: '2026-04-30 23:59:59' },
  { key: 'mayo', label: 'Mayo', f1: '2026-05-01 00:00:00', f2: '2026-05-31 23:59:59' },
]

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const intFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

const num = (v) => Number(v) || 0
const isAnulada = (v) => String(v?.estado_txt ?? '').toLowerCase() === 'comprobante anulado'
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// Descarga los woff2 estaticos de Inter (400/500/600, subsets latin y
// latin-ext que cubren los acentos del espanol) y los devuelve como reglas
// @font-face con data URIs. Incrustar la fuente evita la carrera de red y el
// hinting inconsistente que oscurecia tallos finos como i y l al renderizar.
async function getInterFontFaces() {
  const cssUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  const css = await (await fetch(cssUrl, { headers: { 'User-Agent': ua } })).text()

  const out = []
  const segments = css.split(/(\/\*[^*]+\*\/)/)
  let currentSubset = ''
  for (const seg of segments) {
    const m = seg.match(/\/\*\s*([a-z-]+)\s*\*\//)
    if (m) {
      currentSubset = m[1]
      continue
    }
    if (!seg.includes('@font-face')) continue
    const faces = seg.split('@font-face').slice(1)
    for (const face of faces) {
      if (!/latin/.test(currentSubset)) continue
      const weightM = face.match(/font-weight:\s*(\d+)/)
      const urlM = face.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/)
      const rangeM = face.match(/unicode-range:\s*([^;]+);/)
      if (!weightM || !urlM) continue
      const weight = weightM[1]
      const url = urlM[1]
      const range = rangeM ? rangeM[1].trim() : ''
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
      const b64 = buf.toString('base64')
      out.push(`@font-face{font-family:'Inter';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');${range ? `unicode-range:${range};` : ''}}`)
    }
  }
  if (out.length === 0) throw new Error('No pude incrustar la fuente Inter')
  return out.join('\n')
}

async function callProxy(action, params, attempts = 3) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      console.log(`  Reintentando ${action} (intento ${i + 1}/${attempts}) tras error de red...`)
      await delay(12000)
    }
    try {
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, tenantId: TENANT_ID, params }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Proxy ${action} fallo ${res.status}: ${text}`)
      }
      const json = await res.json()
      if (json.error) throw new Error(`Proxy ${action} error: ${json.error}`)
      return json
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

async function findEscondite() {
  const json = await callProxy('dominio', {})
  const locales = json?.data?.data?.locales ?? []
  const match = locales.find((l) => /escondite/i.test(String(l.local_descripcion ?? '')))
  if (!match) {
    const names = locales.map((l) => l.local_descripcion).join(', ')
    throw new Error(`No encontre la sede Escondite. Locales: ${names}`)
  }
  return { id: Number(match.local_id), desc: match.local_descripcion }
}

function aggregate(ventas) {
  const valid = ventas.filter((v) => !isAnulada(v))
  let ventasTotal = 0
  let impuestos = 0
  let subtotal = 0
  let unidades = 0
  const cats = new Map()
  const canales = {
    rappi: { count: 0, monto: 0 },
    propio: { count: 0, monto: 0 },
    local: { count: 0, monto: 0 },
  }
  let minFecha = null
  let maxFecha = null

  for (const v of valid) {
    const monto = num(v.total)
    ventasTotal += monto
    impuestos += num(v.impuestos)
    subtotal += num(v.subtotal)

    const esDelivery = /delivery/i.test(String(v.canalventa ?? ''))
    const esRappi = /rappi/i.test(String(v.nombre_canaldelivery ?? ''))
    const canal = esRappi ? 'rappi' : esDelivery ? 'propio' : 'local'
    canales[canal].count += 1
    canales[canal].monto += monto

    const fecha = String(v.fecha ?? '').slice(0, 10)
    if (fecha) {
      if (!minFecha || fecha < minFecha) minFecha = fecha
      if (!maxFecha || fecha > maxFecha) maxFecha = fecha
    }
    for (const item of v.detalle ?? []) {
      const qty = num(item.cantidad_vendida)
      const monto = num(item.venta_total)
      unidades += qty
      const cat = item.categoria_descripcion?.trim() || 'Sin categoria'
      const cur = cats.get(cat) ?? { unidades: 0, monto: 0 }
      cur.unidades += qty
      cur.monto += monto
      cats.set(cat, cur)
    }
  }

  const categorias = [...cats.entries()]
    .map(([nombre, d]) => ({ nombre, ...d }))
    .sort((a, b) => b.unidades - a.unidades)

  const count = valid.length
  return {
    count,
    ventasTotal,
    impuestos,
    subtotal,
    unidades,
    ticket: count > 0 ? ventasTotal / count : 0,
    categorias,
    canales,
    minFecha,
    maxFecha,
  }
}

function mergeCanales(a, b) {
  const out = {}
  for (const k of ['rappi', 'propio', 'local']) {
    out[k] = { count: a[k].count + b[k].count, monto: a[k].monto + b[k].monto }
  }
  return out
}

function mergeCategorias(a, b) {
  const m = new Map()
  for (const c of [...a, ...b]) {
    const cur = m.get(c.nombre) ?? { unidades: 0, monto: 0 }
    cur.unidades += c.unidades
    cur.monto += c.monto
    m.set(c.nombre, cur)
  }
  return [...m.entries()]
    .map(([nombre, d]) => ({ nombre, ...d }))
    .sort((a, b) => b.unidades - a.unidades)
}

function fmtFechaLarga(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${d} de ${meses[m - 1]} de ${y}`
}

function buildHtml({ periodo, mesdata, totalAgg, mayoParcial, fontFaces }) {
  const hoy = fmtFechaLarga(new Date().toISOString().slice(0, 10))

  const kpiCard = (label, value, sub) => `
    <div class="kpi">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
    </div>`

  const mesBloque = (m) => {
    const parcial = m.key === 'mayo' && mayoParcial
    return `
    <div class="month">
      <div class="month-head">
        <span class="month-name">${m.label}</span>
        ${parcial ? `<span class="month-tag">datos hasta el ${m.agg.maxFecha ? fmtFechaLarga(m.agg.maxFecha) : 'corte'}</span>` : ''}
      </div>
      <div class="month-grid">
        <div class="cell"><span class="c-label">Ventas</span><span class="c-value">${cop.format(m.agg.ventasTotal)}</span></div>
        <div class="cell"><span class="c-label">Impuestos incluidos</span><span class="c-value">${cop.format(m.agg.impuestos)}</span></div>
        <div class="cell"><span class="c-label">Numero de ventas</span><span class="c-value">${intFmt.format(m.agg.count)}</span></div>
        <div class="cell"><span class="c-label">Unidades vendidas</span><span class="c-value">${intFmt.format(m.agg.unidades)}</span></div>
      </div>
    </div>`
  }

  const totalCanalCount = totalAgg.count || 1
  const canalDefs = [
    { key: 'rappi', label: 'Rappi' },
    { key: 'propio', label: 'Domicilio propio' },
    { key: 'local', label: 'En el local' },
  ]
  const pct = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
  const canalRows = canalDefs
    .map((d) => {
      const c = totalAgg.canales[d.key]
      const p = pct.format((c.count / totalCanalCount) * 100)
      return `
      <tr>
        <td class="cat-name">${d.label}</td>
        <td class="cat-num">${intFmt.format(c.count)}</td>
        <td class="cat-num">${p}%</td>
        <td class="cat-num">${cop.format(c.monto)}</td>
      </tr>`
    })
    .join('')

  const catRows = totalAgg.categorias
    .map(
      (c) => `
      <tr>
        <td class="cat-name">${c.nombre}</td>
        <td class="cat-num">${intFmt.format(c.unidades)}</td>
        <td class="cat-num">${cop.format(c.monto)}</td>
      </tr>`,
    )
    .join('')

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  ${fontFaces}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --surface: #ffffff;
    --card: #faf9f7;
    --bone: #f3f2f0;
    --graphite: #3d3d3d;
    --dark: #2d2d2d;
    --mid: #7d7d7d;
    --border: #eeece9;
    --border-strong: #e2dfd9;
  }
  html, body { background: var(--surface); }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--graphite);
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    font-size: 14px;
    line-height: 1.5;
  }
  .page {}
  .page-break { break-before: page; }
  .keep-together { break-inside: avoid; }

  .header { border-bottom: 1px solid var(--border-strong); padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mid); }
  .title { font-size: 20px; font-weight: 600; color: var(--dark); margin-top: 6px; }
  .subtitle { font-size: 14px; color: var(--mid); margin-top: 4px; }
  .note { font-size: 12px; color: var(--mid); margin-top: 10px; }

  .section-label { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mid); margin: 28px 0 12px; }

  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .kpi { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 16px; }
  .kpi-label { font-size: 12px; color: var(--mid); }
  .kpi-value { font-size: 22px; font-weight: 600; color: var(--dark); margin-top: 8px; line-height: 1.2; }
  .kpi-sub { font-size: 12px; color: var(--mid); margin-top: 4px; }

  .months { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .month { border: 1px solid var(--border); border-radius: 14px; padding: 16px; }
  .month-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; }
  .month-name { font-size: 16px; font-weight: 600; color: var(--dark); }
  .month-tag { font-size: 11px; color: var(--mid); }
  .month-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .cell { display: flex; flex-direction: column; gap: 4px; }
  .c-label { font-size: 12px; color: var(--mid); }
  .c-value { font-size: 15px; font-weight: 600; color: var(--dark); }

  table { width: 100%; border-collapse: collapse; }
  thead th { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--mid); text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border-strong); }
  thead th.num, td.cat-num { text-align: right; }
  tbody td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
  tbody tr:last-child td { border-bottom: none; }
  .cat-name { color: var(--graphite); }
  .cat-num { color: var(--dark); font-weight: 500; font-variant-numeric: tabular-nums; }
  .cat-table { border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }

  .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; font-size: 11px; color: var(--mid); }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">Blue Smash Burger</div>
      <div class="title">Resumen de ventas, sede Escondite</div>
      <div class="subtitle">${periodo}</div>
      ${mayoParcial ? `<div class="note">Mayo es un mes en curso. Las cifras de mayo reflejan las ventas registradas hasta la fecha de este reporte.</div>` : ''}
    </div>

    <div class="section-label">Resumen del periodo</div>
    <div class="kpi-row">
      ${kpiCard('Ventas totales', cop.format(totalAgg.ventasTotal), 'abril y mayo juntos')}
      ${kpiCard('Impuestos incluidos', cop.format(totalAgg.impuestos), '')}
      ${kpiCard('Numero de ventas', intFmt.format(totalAgg.count), '')}
      ${kpiCard('Ticket promedio', cop.format(totalAgg.ticket), 'por venta')}
    </div>

    <div class="section-label">Cada mes en detalle</div>
    <div class="months">
      ${mesBloque(mesdata.abril)}
      ${mesBloque(mesdata.mayo)}
    </div>

    <div class="section-label">Ventas por canal</div>
    <div class="cat-table">
      <table>
        <thead>
          <tr>
            <th>Canal</th>
            <th class="num">Numero de ventas</th>
            <th class="num">Participacion</th>
            <th class="num">Ventas</th>
          </tr>
        </thead>
        <tbody>
          ${canalRows}
        </tbody>
      </table>
    </div>

    <div class="page-break keep-together">
      <div class="section-label">Unidades vendidas por categoria</div>
      <div class="cat-table">
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th class="num">Unidades</th>
              <th class="num">Ventas</th>
            </tr>
          </thead>
          <tbody>
            ${catRows}
          </tbody>
        </table>
      </div>
    </div>

    <div class="footer">
      <span>Generado con BusinessHub</span>
      <span>Reporte del ${hoy}</span>
    </div>
  </div>
</body>
</html>`
}

async function main() {
  console.log('Incrustando la fuente Inter...')
  const fontFaces = await getInterFontFaces()

  console.log('Buscando sede Escondite en el POS...')
  const sede = await findEscondite()
  console.log(`  Sede encontrada: "${sede.desc}" (local_id ${sede.id})`)

  const mesdata = {}
  for (const m of MONTHS) {
    console.log(`Trayendo ventas de ${m.label}...`)
    const json = await callProxy('ventas-batch', { local_ids: [sede.id], f1: m.f1, f2: m.f2 })
    const batch = json?.data ?? {}
    if (batch.rateLimited) {
      throw new Error(`El POS limito la consulta de ${m.label} (rateLimited). Reintenta en unos minutos.`)
    }
    const ventas = batch.ventas ?? []
    const agg = aggregate(ventas)
    mesdata[m.key] = { ...m, agg }
    console.log(`  ${m.label}: ${agg.count} ventas, ${cop.format(agg.ventasTotal)}, ${agg.unidades} unidades`)
    await delay(6000)
  }

  const totalAgg = {
    count: mesdata.abril.agg.count + mesdata.mayo.agg.count,
    ventasTotal: mesdata.abril.agg.ventasTotal + mesdata.mayo.agg.ventasTotal,
    impuestos: mesdata.abril.agg.impuestos + mesdata.mayo.agg.impuestos,
    unidades: mesdata.abril.agg.unidades + mesdata.mayo.agg.unidades,
    categorias: mergeCategorias(mesdata.abril.agg.categorias, mesdata.mayo.agg.categorias),
    canales: mergeCanales(mesdata.abril.agg.canales, mesdata.mayo.agg.canales),
  }
  totalAgg.ticket = totalAgg.count > 0 ? totalAgg.ventasTotal / totalAgg.count : 0

  if (totalAgg.count === 0) {
    throw new Error('No se obtuvieron ventas para el periodo. Aborto sin generar PDF.')
  }

  const mayoParcial = true
  const periodo = 'Abril y mayo de 2026'

  const html = buildHtml({ periodo, mesdata, totalAgg, mayoParcial, fontFaces })

  // Guardar el HTML al lado para inspeccion rapida si hiciera falta.
  const htmlPath = join(homedir(), 'Downloads', '_resumen-escondite.html')
  writeFileSync(htmlPath, html, 'utf8')

  console.log('Renderizando PDF...')
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.emulateMedia({ media: 'print' })
  await page.pdf({
    path: OUT_PATH,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '16mm', left: '16mm', right: '16mm' },
  })
  await browser.close()

  console.log(`\nListo. PDF en:\n  ${OUT_PATH}`)
}

main().catch((err) => {
  console.error('\nERROR:', err.message)
  process.exit(1)
})
