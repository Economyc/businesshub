/**
 * Lee un File del navegador y devuelve su contenido como base64 (sin el
 * prefijo data:). Leer el archivo apenas el usuario lo selecciona — el handle
 * del File se vuelve inválido con el tiempo (NotReadableError) si el archivo
 * cambia en disco, lo toca el antivirus o vive en OneDrive/Drive sin descargar.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = () => {
      const err = reader.error
      if (err?.name === 'NotReadableError') {
        reject(new Error('No se pudo leer el archivo. Vuelve a seleccionarlo (si está en OneDrive/Drive, asegúrate de que esté descargado).'))
      } else {
        reject(err ?? new Error('No se pudo leer el archivo.'))
      }
    }
    reader.readAsDataURL(file)
  })
}
