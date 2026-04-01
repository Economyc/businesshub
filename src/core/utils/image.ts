const THUMB_SIZE = 64

/** Draw image centered inside square canvas preserving aspect ratio */
function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number) {
  const ratio = Math.min(size / img.width, size / img.height)
  const w = img.width * ratio
  const h = img.height * ratio
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
}

export function imageUrlToBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = THUMB_SIZE
        canvas.height = THUMB_SIZE
        const ctx = canvas.getContext('2d')!
        drawContain(ctx, img, THUMB_SIZE)
        resolve(canvas.toDataURL('image/webp', 0.8))
      } catch {
        reject(new Error('Canvas tainted'))
      }
    }
    img.onerror = reject
    img.src = url
  })
}

export function fileToBase64Thumb(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = THUMB_SIZE
        canvas.height = THUMB_SIZE
        const ctx = canvas.getContext('2d')!
        drawContain(ctx, img, THUMB_SIZE)
        resolve(canvas.toDataURL('image/webp', 0.8))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
