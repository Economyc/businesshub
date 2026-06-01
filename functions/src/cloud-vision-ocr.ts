// Helper de OCR sobre Google Cloud Vision API.
// Se usa como fallback cuando ningún vision LLM puede leer el archivo
// (típicamente porque Gemini está sin créditos y Groq Scout no soporta
// el tipo de contenido). Cubre imágenes (ocrImageBase64) y PDFs escaneados
// (ocrPdfBase64). El texto extraído se pasa luego a un proveedor
// text-only (Cerebras / Groq Llama 70b) para extracción estructurada.
//
// Auth: usa ADC del runtime de Cloud Functions — la SA del proyecto ya
// tiene permisos sobre Vision API una vez habilitada
// (vision.googleapis.com).
//
// Pricing: 1000 unidades/mes gratis, $1.50 / 1000 después. Solo se
// invoca como fallback, así que el costo real es marginal.

import vision from '@google-cloud/vision'

let client: InstanceType<typeof vision.ImageAnnotatorClient> | null = null

function getClient(): InstanceType<typeof vision.ImageAnnotatorClient> {
  if (!client) {
    client = new vision.ImageAnnotatorClient()
  }
  return client
}

/**
 * Ejecuta OCR sobre una imagen en base64 y devuelve el texto detectado.
 * Lanza si la imagen es ilegible o si la API responde con error.
 */
export async function ocrImageBase64(fileBase64: string): Promise<string> {
  const c = getClient()
  // documentTextDetection es mejor que textDetection para tablas y texto denso.
  const [result] = await c.documentTextDetection({
    image: { content: fileBase64 },
  })
  const text = result.fullTextAnnotation?.text ?? ''
  return text.trim()
}

/**
 * Ejecuta OCR sobre un PDF en base64 (inline, hasta las primeras 5 páginas) y
 * devuelve el texto detectado concatenado por página. Usa batchAnnotateFiles
 * porque documentTextDetection no acepta PDFs inline. Solo se invoca como
 * fallback cuando pdf-parse no extrajo texto (PDF escaneado / solo imágenes).
 * Lanza si la API responde con error.
 */
export async function ocrPdfBase64(fileBase64: string): Promise<string> {
  const c = getClient()
  const [result] = await c.batchAnnotateFiles({
    requests: [
      {
        inputConfig: { content: fileBase64, mimeType: 'application/pdf' },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        // Sin `pages`: Vision procesa las primeras 5 páginas por defecto,
        // suficiente para facturas genéricas.
      },
    ],
  })
  const pages = result.responses?.[0]?.responses ?? []
  return pages
    .map((p) => p.fullTextAnnotation?.text ?? '')
    .join('\n')
    .trim()
}
