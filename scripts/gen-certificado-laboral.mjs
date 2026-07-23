#!/usr/bin/env node
// Genera la plantilla generica "Certificado Laboral" en .docx para cada razon
// social (Blue Smash Burger SAS y Filipo S.A.S.), con el logo de la marca y
// los datos del empleado como placeholders. Alimenta el modulo Documentos de
// Ecore via seed-document-templates.mjs.
//
// Uso:
//   node scripts/gen-certificado-laboral.mjs            → ambas razones sociales
//   node scripts/gen-certificado-laboral.mjs blue       → solo una
//
// Escribe en ~/Downloads/plantillas/{entity}/Certificado Laboral.docx, que es
// justo la carpeta que lee el seed.

import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const JSZip = require(join(__dirname, '../functions/node_modules/jszip'))

const COMPANIES = {
  blue: {
    legalName: 'BLUE SMASH BURGER SAS',
    nit: 'NIT 901.922.971',
    logo: join(__dirname, 'assets/logo-blue-smash.png'),
    // Ancho en pulgadas con que se inserta el logo; el alto sale del ratio real.
    logoWidthIn: 1.3,
  },
  filipo: {
    legalName: 'FILIPO S.A.S.',
    nit: 'NIT 902.050.129',
    logo: join(__dirname, 'assets/logo-filipo.png'),
    // Wordmark apaisado (ratio ~3.3) → mas ancho que el de Blue para que el
    // alto quede comparable en el membrete.
    logoWidthIn: 2.2,
  },
}

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Lee ancho/alto de un PNG desde su chunk IHDR (bytes 16-23).
function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

// runs: string | [{t, b?, size?}] · align: left|center|both · size en half-points
function p(runs, { align = 'left', size = 22, spacingAfter = 120 } = {}) {
  const rs = (Array.isArray(runs) ? runs : [{ t: runs }])
    .map(
      (r) =>
        `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="${r.size ?? size}"/>${
          r.b ? '<w:b/>' : ''
        }</w:rPr><w:t xml:space="preserve">${esc(r.t)}</w:t></w:r>`,
    )
    .join('')
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="${spacingAfter}" w:line="276" w:lineRule="auto"/></w:pPr>${rs}</w:p>`
}

const EMU_PER_INCH = 914400

function logoParagraph(logoBuf, widthIn) {
  const { width, height } = pngSize(logoBuf)
  const cx = Math.round(widthIn * EMU_PER_INCH)
  const cy = Math.round((cx * height) / width)
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr><w:r><w:drawing>
<wp:inline distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="${cx}" cy="${cy}"/>
<wp:effectExtent l="0" t="0" r="0" b="0"/>
<wp:docPr id="1" name="Logo"/>
<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>
<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
}

function documentXml(company, logoBuf) {
  const body = [
    logoParagraph(logoBuf, company.logoWidthIn),
    p([{ t: company.legalName, b: true }], { align: 'center', spacingAfter: 0 }),
    p(company.nit, { align: 'center', spacingAfter: 360 }),
    p([{ t: 'CERTIFICADO LABORAL', b: true, size: 28 }], { align: 'center', spacingAfter: 360 }),
    p([{ t: `LA EMPRESA ${company.legalName}`, b: true }], { align: 'center', spacingAfter: 0 }),
    p([{ t: 'CERTIFICA QUE:', b: true }], { align: 'center', spacingAfter: 360 }),
    p(
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
      { align: 'both', spacingAfter: 360 },
    ),
    p(
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
      { align: 'both', spacingAfter: 600 },
    ),
    p('Atentamente,', { spacingAfter: 1200 }),
    p('_________________________________', { spacingAfter: 0 }),
    p([{ t: company.legalName, b: true }], { spacingAfter: 0 }),
    p(company.nit),
  ].join('\n')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
<w:body>
${body}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
</w:body></w:document>`
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-CO"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>
</Relationships>`

async function build(entity) {
  const company = COMPANIES[entity]
  const logoBuf = readFileSync(company.logo)

  const zip = new JSZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.folder('_rels').file('.rels', ROOT_RELS)
  zip
    .folder('docProps')
    .file(
      'core.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>Certificado Laboral</dc:title><dc:creator>${esc(company.legalName)}</dc:creator><cp:lastModifiedBy>${esc(company.legalName)}</cp:lastModifiedBy>
</cp:coreProperties>`,
    )
  zip
    .folder('docProps')
    .file(
      'app.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>Microsoft Office Word</Application><Company>${esc(company.legalName)}</Company>
</Properties>`,
    )
  const word = zip.folder('word')
  word.file('document.xml', documentXml(company, logoBuf))
  word.file('styles.xml', STYLES_XML)
  word.folder('_rels').file('document.xml.rels', DOC_RELS)
  word.folder('media').file('logo.png', logoBuf)

  const outDir = join(homedir(), 'Downloads', 'plantillas', entity)
  mkdirSync(outDir, { recursive: true })
  const out = join(outDir, 'Certificado Laboral.docx')
  writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
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
