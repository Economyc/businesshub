#!/usr/bin/env node
// Graba el video tutorial de Marcacion (App2) sobre produccion y lo deja en MP4.
// Pensado para gente no tecnica: pasos numerados, frases cortas y un "foco" que
// oscurece la pantalla y deja iluminado solo lo que importa en cada paso.
//
//   TUTORIAL_EMAIL=... TUTORIAL_PASS=... node scripts/tutorial-marcacion.mjs
//
// Variables opcionales:
//   TUTORIAL_BASE_URL   (default https://businessadm.economyc.cc)
//   TUTORIAL_COMPANY    sede a mostrar en el selector del sidebar (default Manila)
//   TUTORIAL_OUT        ruta del MP4 (default ~/Downloads/tutorial-marcacion.mp4)
//   HEADED=1            ver el navegador mientras graba
//
// No escribe nada en produccion: los dialogos se cierran con Cancelar y en el
// kiosco la llamada `attendancePunch` se intercepta con una respuesta falsa. La
// camara es una cara sintetica (scripts/tutorial-assets/fake-face.jpg, generada
// por GAN, no es una persona). Requiere ffmpeg en el PATH.

import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.TUTORIAL_BASE_URL ?? 'https://businessadm.economyc.cc'
const EMAIL = process.env.TUTORIAL_EMAIL
const PASS = process.env.TUTORIAL_PASS
const COMPANY = process.env.TUTORIAL_COMPANY ?? 'Manila'
const OUT = process.env.TUTORIAL_OUT ?? join(homedir(), 'Downloads', 'tutorial-marcacion.mp4')
const DEMO_NAME = 'Andrés Demo'
// Viewport chico que ffmpeg escala a 1280x800: la UI sale ~25% mas grande y se lee
// en el celular. (recordVideo no escala: con size mayor deja franjas grises.)
const VIEWPORT = { width: 1024, height: 640 }
const VIDEO = { width: 1280, height: 800 }

const ICON_ADMIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 12l3-3 3 2 4-4"/></svg>'
const ICON_TABLET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17c1-1.5 2.5-2 4-2s3 .5 4 2"/></svg>'

const CARD_CSS = `
  body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#f3f2ef;
    font-family:Inter,system-ui,sans-serif;color:#1f1f1f}
  .c{display:flex;flex-direction:column;align-items:center;text-align:center;gap:18px}
  .n{width:64px;height:64px;border-radius:50%;background:#1f1f1f;color:#fff;display:flex;align-items:center;
    justify-content:center;font-size:32px;font-weight:600}
  .i{width:88px;height:88px;color:#1f1f1f}
  h1{font-size:56px;font-weight:600;margin:0;letter-spacing:-.02em}
  p{font-size:24px;color:#6b6861;margin:0}
  .u{font-family:ui-monospace,Consolas,monospace;font-size:17px;background:#fff;border:1px solid #e2e0da;
    padding:10px 16px;border-radius:12px;margin-top:8px}
  .rows{display:flex;flex-direction:column;gap:20px;width:860px}
  .r{display:flex;gap:20px;align-items:center;padding:20px 24px;border:1px solid #e2e0da;border-radius:16px;background:#fff;text-align:left}
  .r .n{width:56px;height:56px;font-size:26px;flex-shrink:0}
  .r b{display:block;font-size:32px;font-weight:600;margin-bottom:4px}
  .r span{font-size:24px;color:#6b6861}`

if (!EMAIL || !PASS) {
  console.error('Falta TUTORIAL_EMAIL / TUTORIAL_PASS')
  process.exit(1)
}

const here = dirname(fileURLToPath(import.meta.url))
const work = mkdtempSync(join(tmpdir(), 'tutorial-marcacion-'))

// ── Camara falsa: la foto se vuelve un y4m que Chromium reproduce en loop ──
const faceY4m = join(work, 'face.y4m')
execFileSync('ffmpeg', [
  '-v', 'error', '-y', '-loop', '1', '-i', join(here, 'tutorial-assets', 'fake-face.jpg'),
  '-t', '2', '-r', '15', '-vf', 'scale=640:640,crop=640:480:0:90,format=yuv420p', faceY4m,
])

const browser = await chromium.launch({
  headless: !process.env.HEADED,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${faceY4m}`,
  ],
})

// ── 1. Login fuera de la grabacion ──
const authFile = join(work, 'auth.json')
{
  const ctx = await browser.newContext({ viewport: VIEWPORT })
  const page = await ctx.newPage()
  // La red a veces corta el primer goto: se reintenta.
  for (let i = 0; ; i++) {
    try { await page.goto(`${BASE}/login`); break } catch (e) { if (i >= 2) throw e }
  }
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASS)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.getByRole('link', { name: 'Marcación' }).waitFor({ timeout: 90_000 })
  await ensureCompany(page)
  await page.waitForTimeout(2_000)
  await ctx.storageState({ path: authFile, indexedDB: true })
  await ctx.close()
}

// ── 2. Contexto grabado ──
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  storageState: authFile,
  recordVideo: { dir: work, size: VIEWPORT },
  permissions: ['camera', 'clipboard-read', 'clipboard-write'],
  locale: 'es-CO',
  timezoneId: 'America/Bogota',
})
await ctx.addInitScript(overlayScript)

// Precarga en una pestana aparte (su video se descarta): deja en cache los datos
// del panel y los modelos de reconocimiento facial.
{
  const warm = await ctx.newPage()
  await warm.goto(`${BASE}/marcacion`)
  const href = await warm.getByLabel('Abrir link').getAttribute('href', { timeout: 60_000 })
  await warm.waitForTimeout(3_000)
  await warm.goto(href)
  await expectEnabled(warm.getByRole('button', { name: 'Tomar foto' }))
  await warm.close()
}

const page = await ctx.newPage()
const t0 = Date.now()
/** Tramos [desde, hasta] en segundos que se cortan del video (cargas). */
// El primer cuadro sale antes de ajustar el viewport (franja gris): se corta.
const cuts = [[0, 0.2]]

// Kiosco: la marcacion real se reemplaza por una respuesta falsa. El "warm" pasa.
await page.route('**/attendancePunch', async (route) => {
  const req = route.request()
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders() })
  if (req.postDataJSON()?.data?.warm) {
    return route.fulfill({ status: 200, headers: corsHeaders(), json: { result: { warm: true } } })
  }
  await new Promise((r) => setTimeout(r, 900))
  return route.fulfill({
    status: 200,
    headers: corsHeaders(),
    json: { result: { matched: true, duplicate: false, employeeName: DEMO_NAME, type: 'in', at: new Date().toISOString() } },
  })
})

try {
  await run(page)
} finally {
  const video = page.video()
  await ctx.close()
  await browser.close()
  const webm = await video.path()
  if (process.env.DEBUG) console.log('cuts', JSON.stringify(cuts))
  const vf = [
    ...(cuts.length
      ? [`select='not(${cuts.map(([a, b]) => `between(t,${a.toFixed(2)},${b.toFixed(2)})`).join('+')})'`, 'setpts=N/FRAME_RATE/TB']
      : []),
    `scale=${VIDEO.width}:${VIDEO.height}:flags=lanczos`,
  ]
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-i', webm,
    '-vf', vf.join(','),
    '-r', '25', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    OUT,
  ])
  rmSync(work, { recursive: true, force: true })
  console.log(`Video: ${OUT}`)
}

// ─────────────────────────────────────────────────────────────────────────
async function run(page) {
  // ── Parte 1: administrador ──
  await showCard(page, card({
    n: '1', title: 'Administrador', subtitle: 'Revisa y corrige las marcaciones', url: 'businessadm.economyc.cc/marcacion', icon: ICON_ADMIN,
  }))
  await page.waitForTimeout(3_500)

  await withoutLoading(async () => {
    await page.goto(`${BASE}/marcacion`)
    await page.locator('button:has(span:text-matches("/marcar/"))').waitFor({ timeout: 30_000 })
    await page.waitForTimeout(500)
  })

  // Link de la tablet
  const linkBar = page.locator('div.card-elevated').filter({ hasText: 'Link de la tablet' }).first()
  await step(page, linkBar, 'Este link va en la tablet del local')

  // Empleados
  await clickAt(page, page.getByRole('tab', { name: /Empleados/ }))
  await page.getByText(/empleados registrados/).waitFor()
  await page.waitForTimeout(400)
  await step(page, page.locator('main div.card-elevated.divide-y > div').filter({ hasText: 'Registrado' }).first(), 'Registra la cara de cada empleado')

  // Llegadas tarde
  await clickAt(page, page.getByRole('tab', { name: 'Marcaciones' }))
  await clickAt(page, page.getByRole('button', { name: 'Hoy' }))
  await clickAt(page, page.getByText('Últimos 30 días').first())
  const lateBadge = page.getByText(/^Tarde \d+ min$/).first()
  await lateBadge.waitFor({ timeout: 10_000 }).catch(() => undefined)
  if (await lateBadge.count()) {
    await page.waitForTimeout(400)
    const row = page.locator('button').filter({ has: lateBadge }).first()
    await step(page, row, 'Aquí ves quién llegó tarde')
  } else {
    await step(page, page.getByText('Llegadas tarde', { exact: true }).first().locator('..').locator('..'), 'Aquí ves quién llegó tarde')
  }

  // Marcacion manual
  await clickAt(page, page.getByRole('button', { name: 'Agregar marcación' }))
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await dialog.getByRole('button', { name: 'Elegir empleado...' }).click()
  await page.locator('div[class*="z-[100]"] button').first().click()
  await dialog.locator('input[type="time"]').fill('08:00')
  await dialog.getByPlaceholder(/olvidó marcar/).fill('Olvidó marcar la entrada')
  await page.waitForTimeout(300)
  await step(page, dialog, '¿Olvidó marcar? Agrégala a mano')
  await spot(page, null)
  await clickAt(page, dialog.getByRole('button', { name: 'Cancelar' }))

  // Nomina
  await step(page, page.getByRole('button', { name: 'Nómina' }), 'Descarga las horas para la nómina')

  // ── Parte 2: empleado ──
  const kioskUrl = await page.getByLabel('Abrir link').getAttribute('href')
  await caption(page, '')
  await showCard(page, card({
    n: '2', title: 'Empleado', subtitle: 'Marca entrada y salida en la tablet del local', url: 'businessadm.economyc.cc/marcar/…', icon: ICON_TABLET,
  }))
  await page.waitForTimeout(3_500)

  await withoutLoading(async () => {
    await page.goto(kioskUrl)
    // En la grabacion la camara se achica para que todo quepa en pantalla.
    await page.addStyleTag({ content: 'main .max-w-2xl{max-width:500px!important}' })
    await expectEnabled(page.getByRole('button', { name: 'Tomar foto' }))
    await page.waitForTimeout(300)
  })

  const shoot = page.getByRole('button', { name: 'Tomar foto' })
  const camera = page.locator('main .aspect-\\[4\\/3\\]')
  await step(page, camera, 'Mira a la cámara')
  await step(page, shoot, 'Toca "Tomar foto"', 2_200)
  // Se deja ver 1 s de "Reconociendo…" y se corta el resto: el reconocimiento
  // bloquea la pagina varios segundos (el click mismo no vuelve hasta que termina).
  const from = (Date.now() - t0) / 1000 + 1
  await shoot.click()
  await page.getByText(/registrada/).waitFor({ timeout: 20_000 })
  const to = (Date.now() - t0) / 1000 - 0.2
  if (to > from) cuts.push([from, to])
  if (process.env.DEBUG) console.log('reconocer', from, to)
  await step(page, camera, '¡Listo! Tu entrada quedó registrada', 2_600)

  // Cierre
  await caption(page, '')
  await showCard(page, summaryCard())
  await page.waitForTimeout(5_000)
}

// ── Helpers ──────────────────────────────────────────────────────────────
/** Un paso: foco sobre el elemento, cursor encima y la frase abajo. */
async function step(page, locator, text, ms = 3_200) {
  if (process.env.DEBUG) console.log('step', text, (Date.now() - t0) / 1000)
  await locator.waitFor({ state: 'visible' })
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(150)
  await spot(page, locator)
  await caption(page, text)
  const b = await locator.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.waitForTimeout(ms)
}

async function spot(page, locator) {
  if (!locator) return page.evaluate(() => window.__tut?.spot(null))
  await locator.evaluate((el) => window.__tut?.spot(el))
  await page.waitForTimeout(350)
}

async function caption(page, text) {
  await page.evaluate((t) => window.__tut?.caption(t), text).catch(() => undefined)
}

/** Corre `fn` y corta del video lo que tardo (cargas de pagina). */
async function withoutLoading(fn) {
  const a = (Date.now() - t0) / 1000
  await fn()
  const b = (Date.now() - t0) / 1000
  if (b - a > 0.4) cuts.push([a + 0.1, b - 0.1])
}

async function showCard(page, html) {
  await page.setContent(html)
}

async function ensureCompany(page) {
  const pill = page.locator('nav button').nth(1)
  if ((await pill.innerText()).includes(COMPANY)) return
  await pill.click()
  await page.getByText(COMPANY, { exact: false }).last().click()
  await page.waitForTimeout(1_500)
}

function corsHeaders() {
  return {
    'access-control-allow-origin': BASE,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
  }
}

async function clickAt(page, locator) {
  await page.evaluate(() => { window.__tut?.spot(null); window.__tut?.caption('') })
  await locator.waitFor({ state: 'visible' })
  const b = await locator.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 })
  await locator.click()
  await page.waitForTimeout(350)
}

async function expectEnabled(locator) {
  for (let i = 0; i < 120; i++) {
    if (await locator.isEnabled().catch(() => false)) return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('El boton no se habilito')
}

function page0(body) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CARD_CSS}</style></head><body>${body}</body></html>`
}

function card({ n, title, subtitle, url, icon }) {
  return page0(`<div class="c"><div class="n">${n}</div><div class="i">${icon}</div>
<h1>${title}</h1><p>${subtitle}</p><div class="u">${url}</div></div>`)
}

function summaryCard() {
  return page0(`<div class="c"><h1 style="font-size:44px;margin-bottom:12px">En resumen</h1><div class="rows">
<div class="r"><div class="n">1</div><div><b>Administrador</b><span>Registra caras, revisa llegadas tarde, corrige y descarga la nómina</span></div></div>
<div class="r"><div class="n">2</div><div><b>Empleado</b><span>Mira a la cámara de la tablet y toca "Tomar foto"</span></div></div>
</div></div>`)
}

// Se inyecta en cada pagina: frase grande abajo, foco (oscurece todo menos un
// rectangulo) y cursor visible (Playwright no graba el cursor del sistema).
function overlayScript() {
  const mount = () => {
    if (document.getElementById('__tut_cap')) return
    const style = document.createElement('style')
    style.textContent = `
      #__tut_spot{position:fixed;z-index:2147483645;pointer-events:none;border-radius:14px;opacity:0;
        box-shadow:0 0 0 9999px rgba(20,20,20,.62);outline:3px solid #f5c542;outline-offset:2px;
        transition:all .35s ease}
      #__tut_cap{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483646;pointer-events:none;
        background:#1f1f1f;color:#fff;border-radius:18px;padding:14px 28px;white-space:nowrap;
        font:600 28px/1.3 Inter,system-ui,sans-serif;transition:opacity .25s;opacity:0}
      #__tut_cur{position:fixed;left:-100px;top:-100px;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;
        background:rgba(245,197,66,.55);border:2px solid #1f1f1f;z-index:2147483647;pointer-events:none;transition:transform .15s}
      #__tut_cur.down{transform:scale(.7);background:#f5c542}`
    document.documentElement.appendChild(style)
    const spot = document.createElement('div'); spot.id = '__tut_spot'
    const cap = document.createElement('div'); cap.id = '__tut_cap'
    const cur = document.createElement('div'); cur.id = '__tut_cur'
    // En el kiosco el boton va abajo: la frase sube sobre la cabecera.
    if (location.pathname.startsWith('/marcar/')) { cap.style.bottom = 'auto'; cap.style.top = '20px' }
    document.documentElement.append(spot, cap, cur)
    let target = null
    const follow = () => {
      if (target && target.isConnected) {
        const r = target.getBoundingClientRect(), p = 8
        Object.assign(spot.style, { left: r.x - p + 'px', top: r.y - p + 'px', width: r.width + 2 * p + 'px', height: r.height + 2 * p + 'px', opacity: '1' })
      } else if (target) spot.style.opacity = '0'
      requestAnimationFrame(follow)
    }
    requestAnimationFrame(follow)
    window.addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px' }, true)
    window.addEventListener('mousedown', () => cur.classList.add('down'), true)
    window.addEventListener('mouseup', () => cur.classList.remove('down'), true)
    window.__tut = {
      caption(t) { if (t) cap.textContent = t; cap.style.opacity = t ? '1' : '0' },
      // Sigue al elemento en cada frame: si la pagina se mueve, el foco no queda corrido.
      spot(el) {
        target = el
        if (!el) spot.style.opacity = '0'
      },
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
}
