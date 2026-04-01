import { ref as storageRef, listAll, getDownloadURL } from 'firebase/storage'
import { storage } from '@/core/firebase/config'
import { cacheGet, cacheSet } from '@/core/utils/cache'

const CACHE_KEY = 'logo-urls'

// In-memory mirror — survives across component renders
let urlCache: string[] = cacheGet<string[]>(CACHE_KEY) ?? []
let preloaded = false
let preloadPromise: Promise<void> | null = null

/** Get cached logo URLs instantly (synchronous) */
export function getCachedLogoUrls(): string[] {
  return urlCache
}

/** Preload images into browser cache using hidden Image objects */
function warmBrowserCache(urls: string[]) {
  for (const url of urls) {
    const img = new Image()
    img.src = url // browser downloads + caches it
  }
}

/** Preload all logos from Firebase Storage — call once at app start */
export function preloadLogos(): Promise<void> {
  if (preloadPromise) return preloadPromise
  preloadPromise = _preload()
  return preloadPromise
}

async function _preload() {
  if (preloaded) return

  // Warm browser cache immediately with whatever we have from localStorage
  if (urlCache.length > 0) {
    warmBrowserCache(urlCache)
  }

  try {
    // Fetch fresh list from Firebase Storage
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

    urlCache = deduped
    cacheSet(CACHE_KEY, deduped)

    // Warm browser cache with any new URLs
    warmBrowserCache(deduped)
    preloaded = true
  } catch (err) {
    console.error('Logo preload failed:', err)
    preloaded = true
  }
}

/** Add a newly uploaded logo URL to the cache immediately */
export function addLogoToCache(url: string) {
  urlCache = [url, ...urlCache.filter((u) => u !== url)]
  cacheSet(CACHE_KEY, urlCache)
}
