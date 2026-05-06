/**
 * Validación de imágenes adjuntadas al ChatInput del agente.
 *
 * Reglas:
 * - Tamaño máximo (pre-resize): 5 MB.
 * - Tipos permitidos: JPEG, PNG, WebP, HEIC, HEIF.
 *
 * El servidor aplica la misma validación como defense-in-depth (mantener
 * en sincronía la lista de tipos y el límite con `functions/src/agent-chat.ts`).
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB

export const ALLOWED_IMAGE_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

export type AllowedImageMimetype = (typeof ALLOWED_IMAGE_MIMETYPES)[number]

export type ImageValidationError =
  | { kind: 'too-large'; actual: number; max: number }
  | { kind: 'unsupported-type'; actual: string }
  | { kind: 'corrupt' }

/**
 * Devuelve `null` si el archivo pasa la validación, o un objeto de error
 * estructurado cuando falla. No lanza.
 */
export function validateImageFile(file: File): ImageValidationError | null {
  if (file.size > MAX_IMAGE_BYTES) {
    return { kind: 'too-large', actual: file.size, max: MAX_IMAGE_BYTES }
  }
  const mimetype = (file.type ?? '').toLowerCase()
  if (!(ALLOWED_IMAGE_MIMETYPES as readonly string[]).includes(mimetype)) {
    return { kind: 'unsupported-type', actual: file.type || 'desconocido' }
  }
  return null
}

/**
 * Mensaje friendly en español listo para mostrar al usuario.
 */
export function formatImageError(err: ImageValidationError): string {
  switch (err.kind) {
    case 'too-large': {
      const mb = (err.actual / (1024 * 1024)).toFixed(1)
      return `La imagen pesa ${mb} MB. Máximo 5 MB.`
    }
    case 'unsupported-type':
      return `Tipo no soportado: ${err.actual}. Usa JPG, PNG, WebP, HEIC.`
    case 'corrupt':
      return 'La imagen no se pudo procesar.'
  }
}
