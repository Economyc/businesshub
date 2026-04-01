const THUMB_SIZE = 64

/** Draw image filling square canvas (cover), cropping excess without distortion */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number) {
  const ratio = Math.max(size / img.width, size / img.height)
  const w = img.width * ratio
  const h = img.height * ratio
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
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
        drawCover(ctx, img, THUMB_SIZE)
        resolve(canvas.toDataURL('image/webp', 0.8))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
