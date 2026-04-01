import { ref as storageRef, listAll, getDownloadURL } from 'firebase/storage'
import { storage } from '@/core/firebase/config'
import { cacheGet, cacheSet } from '@/core/utils/cache'

interface CachedLogo {
  url: string
  thumb: string // base64 thumbnail OR original url as fallback
}

const CACHE_KEY = 'logos'
const THUMB_SIZE = 48

// In-memory mirror — always up to date
let memoryCache: CachedLogo[] = cacheGet<CachedLogo[]>(CACHE_KEY) ?? []
let preloaded = false
let preloadPromise: Promise<void> | null = null

/** Get cached logos instantly (synchronous) */
export function getCachedLogos(): CachedLogo[] {
  return memoryCache
}

/** Convert image URL → tiny base64 thumbnail */
function urlToThumb(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = THUMB_SIZE
        canvas.height = THUMB_SIZE
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, THUMB_SIZE, THUMB_SIZE)
        resolve(canvas.toDataURL('image/webp', 0.7))
      } catch {
        // Canvas tainted by CORS — fall back to URL
        resolve(url)
      }
    }
    img.onerror = reject
    img.src = url
  })
}

/** Preload all logos from Firebase Storage — call once at app start */
export function preloadLogos(): Promise<void> {
  if (preloadPromise) return preloadPromise
  preloadPromise = _preload()
  return preloadPromise
}

async function _preload() {
  if (preloaded) return
  try {
    // Fetch list from Firebase Storage
    const logosRoot = storageRef(storage, 'logos')
    const rootResult = await listAll(logosRoot)
    const folderResults = await Promise.all(
      rootResult.prefixes.map((folder) => listAll(folder))
    )
    const allItems = [
      ...rootResult.items,
      ...folderResults.flatMap((r) => r.items),
    ]
    const urls = await Promise.all(allItems.map((item) => getDownloadURL(item)))
    const deduped = [...new Set(urls)]

    // Build map of already-cached thumbnails for fast lookup
    const existingThumbs = new Map(memoryCache.map((l) => [l.url, l.thumb]))

    // Only generate thumbnails for new logos
    const newUrls = deduped.filter((url) => !existingThumbs.has(url))
    const newThumbs = await Promise.all(
      newUrls.map((url) =>
        urlToThumb(url).catch(() => url) // CORS fail → use original URL
      )
    )

    // Merge: keep existing thumbs + add new ones
    const merged: CachedLogo[] = deduped.map((url) => {
      const existingThumb = existingThumbs.get(url)
      if (existingThumb) return { url, thumb: existingThumb }
      const newIdx = newUrls.indexOf(url)
      const thumb = newIdx >= 0 ? newThumbs[newIdx] : url
      return { url, thumb }
    })

    memoryCache = merged
    cacheSet(CACHE_KEY, merged)
    preloaded = true
  } catch (err) {
    console.error('Logo preload failed:', err)
    preloaded = true // don't retry
  }
}

/** Add a newly uploaded logo to the cache immediately */
export function addLogoToCache(url: string, thumb: string) {
  // Prepend new logo, remove duplicates
  memoryCache = [{ url, thumb }, ...memoryCache.filter((l) => l.url !== url)]
  cacheSet(CACHE_KEY, memoryCache)
}
