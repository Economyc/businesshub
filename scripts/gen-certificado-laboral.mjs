#!/usr/bin/env node
// Genera la plantilla generica "Certificado Laboral" en PDF para cada razon
// social (Blue Smash Burger SAS y Filipo S.A.S.), replicando el layout del
// certificado real: logo arriba a la IZQUIERDA sobre el margen, encabezado
// centrado, cuerpo justificado y bloque de firma. Los datos del empleado van
// como placeholders en negrita. Alimenta el modulo Documentos de Ecore via
// seed-document-templates.mjs.
//
// Uso:
//   node scripts/gen-certificado-laboral.mjs            → ambas razones sociales
//   node scripts/gen-certificado-laboral.mjs blue       → solo una
//
// Escribe en ~/Downloads/plantillas/{entity}/Certificado Laboral.pdf, que es
// justo la carpeta que lee el seed.

import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const { PDFDocument, StandardFonts, rgb } = require(join(__dirname, '../functions/node_modules/pdf-lib'))

// Geometria tomada del certificado original (pdfjs sobre el PDF real):
// pagina Letter 612x792, margenes simetricos de 96.7pt, logo alineado al
// margen izquierdo con borde superior en y=723.6.
const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 96.7
const CONTENT_W = PAGE_W - MARGIN * 2 // 418.6
const LOGO_TOP = 723.6

const SIZE_HEAD = 12.5 // razon social, titulo, "CERTIFICA QUE:"
const SIZE_NIT = 12
const SIZE_BODY = 11.5
const LEADING = 19 // interlineado del cuerpo en el original

// Baselines fijas del encabezado (y desde el borde inferior), como el original.
const Y_LEGAL_NAME = 618.2
const Y_NIT = 596.7
const Y_TITLE = 558.2
const Y_COMPANY_LINE = 520.2
const Y_CERTIFICA = 484.2
const Y_BODY_START = 447.2

// Separaciones verticales entre bloques, medidas en el original. Se aplican en
// cascada para que el documento fluya bien aunque el texto envuelva distinto.
const GAP_P1_P2 = 37
const GAP_P2_ATENTAMENTE = 59
const GAP_ATENTAMENTE_FIRMA = 75
const GAP_FIRMA_NOMBRE = 15

const COMPANIES = {
  blue: {
    legalName: 'BLUE SMASH BURGER SAS',
    nit: 'NIT 901.922.971',
    logo: join(__dirname, 'assets/logo-blue-smash.png'),
    // Medidas exactas del logo en el certificado original.
    logoWidth: 96.4,
  },
  filipo: {
    legalName: 'FILIPO S.A.S.',
    nit: 'NIT 902.050.129',
    logo: join(__dirname, 'assets/logo-filipo.png'),
    // Wordmark apaisado (ratio ~3.3): se fija el ancho para que el alto quede
    // proporcionado en el membrete; comparte margen y borde superior con Blue.
    logoWidth: 170,
  },
}

// --- Layout de texto con runs mixtos (normal / negrita) ---

// Convierte runs [{t, b?}] en palabras; cada palabra es una lista de segmentos
// con su fuente, para que un placeholder en negrita pegado a un signo de
// puntuacion normal (ej. "[CARGO]," ) no se separe en dos palabras.
function toWords(runs, fonts) {
  const words = []
  let current = []
  for (const run of runs) {
    const font = run.b ? fonts.bold : fonts.regular
    const parts = run.t.split(' ')
    parts.forEach((part, i) => {
      if (i > 0) {
        if (current.length) words.push(current)
        current = []
      }
      if (part) current.push({ text: part, font })
    })
  }
  if (current.length) words.push(current)
  return words
}

const wordWidth = (word, size) =>
  word.reduce((sum, seg) => sum + seg.font.widthOfTextAtSize(seg.text, size), 0)

// Dibuja un parrafo justificado (ultima linea alineada a la izquierda) y
// devuelve la baseline de su ultima linea.
function drawParagraph(page, runs, { x, y, width, size, leading, fonts, justify = true }) {
  const words = toWords(runs, fonts)
  const spaceW = fonts.regular.widthOfTextAtSize(' ', size)

  const lines = []
  let line = []
  let lineW = 0
  for (const word of words) {
    const w = wordWidth(word, size)
    const projected = line.length ? lineW + spaceW + w : w
    if (line.length && projected > width) {
      lines.push({ words: line, width: lineW })
      line = [word]
      lineW = w
    } else {
      line.push(word)
      lineW = projected
    }
  }
  if (line.length) lines.push({ words: line, width: lineW })

  let baseline = y
  lines.forEach((ln, idx) => {
    const isLast = idx === lines.length - 1
    // Justificado: el sobrante se reparte entre los huecos de la linea.
    const gap =
      justify && !isLast && ln.words.length > 1
        ? spaceW + (width - ln.width) / (ln.words.length - 1)
        : spaceW
    let cursor = x
    for (const word of ln.words) {
      for (const seg of word) {
        page.drawText(seg.text, { x: cursor, y: baseline, size, font: seg.font, color: rgb(0, 0, 0) })
        cursor += seg.font.widthOfTextAtSize(seg.text, size)
      }
      cursor += gap
    }
    if (!isLast) baseline -= leading
  })
  return baseline
}

function drawCentered(page, text, { y, size, font }) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (PAGE_W - w) / 2, y, size, font, color: rgb(0, 0, 0) })
}

async function build(entity) {
  const company = COMPANIES[entity]
  const pdf = await PDFDocument.create()
  pdf.setTitle('Certificado Laboral')
  pdf.setAuthor(company.legalName)
  pdf.setProducer(company.legalName)

  const page = pdf.addPage([PAGE_W, PAGE_H])
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  }

  // Logo: arriba a la IZQUIERDA, alineado al margen del texto (igual que el
  // certificado original), con el borde superior a la misma altura para ambas
  // marcas aunque sus proporciones sean distintas.
  const logoImg = await pdf.embedPng(readFileSync(company.logo))
  const logoH = (company.logoWidth * logoImg.height) / logoImg.width
  page.drawImage(logoImg, {
    x: MARGIN,
    y: LOGO_TOP - logoH,
    width: company.logoWidth,
    height: logoH,
  })

  drawCentered(page, company.legalName, { y: Y_LEGAL_NAME, size: SIZE_HEAD, font: fonts.bold })
  drawCentered(page, company.nit, { y: Y_NIT, size: SIZE_NIT, font: fonts.regular })
  drawCentered(page, 'CERTIFICADO LABORAL', { y: Y_TITLE, size: SIZE_HEAD, font: fonts.bold })
  drawCentered(page, `LA EMPRESA ${company.legalName}`, { y: Y_COMPANY_LINE, size: SIZE_HEAD, font: fonts.bold })
  drawCentered(page, 'CERTIFICA QUE:', { y: Y_CERTIFICA, size: SIZE_HEAD, font: fonts.bold })

  const common = { x: MARGIN, width: CONTENT_W, size: SIZE_BODY, leading: LEADING, fonts }

  const endP1 = drawParagraph(
    page,
    [
      { t: 'El(La) señor(a) ' },
      { t: '[NOMBRE COMPLETO DEL EMPLEADO]', b: true },
      { t: ', identificado(a) con cédula de ciudadanía No. ' },
      { t: '[NÚMERO DE CÉDULA]', b: true },
      { t: ', labora en nuestra empresa desde el ' },
      { t: '[FECHA DE INGRESO]', b: true },
      { t: ' hasta la fecha, desempeñando el cargo de ' },
      { t: '[CARGO]', b: true },
      { t: ', mediante contrato de trabajo a término ' },
      { t: '[INDEFINIDO / FIJO]', b: true },
      { t: ', devengando un salario mensual de ' },
      { t: '[SALARIO EN LETRAS]', b: true },
      { t: ' PESOS M/CTE ($' },
      { t: '[SALARIO EN NÚMEROS]', b: true },
      { t: ' COP).' },
    ],
    { ...common, y: Y_BODY_START },
  )

  const endP2 = drawParagraph(
    page,
    [
      { t: 'La presente certificación se expide a solicitud del interesado, en la ciudad de ' },
      { t: '[CIUDAD]', b: true },
      { t: ', a los ' },
      { t: '[DÍA EN LETRAS]', b: true },
      { t: ' (' },
      { t: '[DD]', b: true },
      { t: ') días del mes de ' },
      { t: '[MES]', b: true },
      { t: ' de ' },
      { t: '[AÑO]', b: true },
      { t: '.' },
    ],
    { ...common, y: endP1 - GAP_P1_P2 },
  )

  const yAtentamente = endP2 - GAP_P2_ATENTAMENTE
  const yFirma = yAtentamente - GAP_ATENTAMENTE_FIRMA
  const draw = (text, y, font = fonts.regular) =>
    page.drawText(text, { x: MARGIN, y, size: SIZE_BODY, font, color: rgb(0, 0, 0) })

  draw('Atentamente,', yAtentamente)
  draw('_________________________________', yFirma)
  draw(company.legalName, yFirma - GAP_FIRMA_NOMBRE, fonts.bold)
  draw(company.nit, yFirma - GAP_FIRMA_NOMBRE * 2)

  const outDir = join(homedir(), 'Downloads', 'plantillas', entity)
  mkdirSync(outDir, { recursive: true })
  const out = join(outDir, 'Certificado Laboral.pdf')
  writeFileSync(out, await pdf.save())
  console.log(`  ✓ ${company.legalName} → ${out}`)
}

const only = process.argv[2]
const targets = only ? [only] : Object.keys(COMPANIES)
for (const t of targets) {
  if (!COMPANIES[t]) {
    console.error(`Razon social desconocida: ${t}. Usa: ${Object.keys(COMPANIES).join(', ')}`)
    process.exit(1)
  }
  await build(t)
}
