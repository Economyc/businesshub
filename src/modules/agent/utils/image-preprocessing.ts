/**
 * Preprocesses an image for sending to the LLM.
 * Resizes to max 1024px and compresses to JPEG 85% quality.
 * Returns a new File object if processing was needed.
 */
export async function preprocessImage(file: File): Promise<File> {
  // If already small enough, return as-is
  if (file.size < 2 * 1024 * 1024) return file

  const img = await createImageBitmap(file)
  const canvas = document.createElement('canvas')

  // Max dimension: 1024px (sufficient for OCR, saves tokens)
  const maxDim = 1024
  const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
  canvas.width = img.width * scale
  canvas.height = img.height * scale

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85)
  )

  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
    type: 'image/jpeg',
  })
}

/**
 * Checks if a file is an image type supported by Gemini.
 */
export function isImageFile(file: File): boolean {
  return /^image\/(jpeg|jpg|png|webp|heic|heif|gif)$/i.test(file.type)
}

/**
 * Checks if a file is an Excel or CSV file.
 */
export function isSpreadsheetFile(file: File): boolean {
  const excelTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ]
  return excelTypes.includes(file.type) || /\.(xlsx|xls|csv)$/i.test(file.name)
}
