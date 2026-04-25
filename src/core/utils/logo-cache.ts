import { ref as storageRef, listAll, getDownloadURL, deleteObject } from 'firebase/storage'
import { getAppStorage } from '@/core/firebase/config'
import { cacheGet, cacheSet } from '@/core/utils/cache'

const CACHE_KEY = 'logo-urls'
const PATH_KEY = 'logo-paths'

// In-memory mirror — survives across component renders
let urlCache: string[] = cacheGet<string[]>(CACHE_KEY) ?? []
let pathMap = new Map<string, string>(
  Object.entries(cacheGet<Record<string, string>>(PATH_KEY) ?? {})
)
let preloaded = false
let preloadPromise: Promise<void> | null = null

/** Get cached logo URLs instantly (synchronous) */
export function getCachedLogoUrls(): string[] {
  return urlCache
}

/** Get the Firebase Storage path for a cached logo URL */
export function getLogoStoragePath(url: string): string | undefined {
  return pathMap.get(url)
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
    const storage = await getAppStorage()
    const logosRoot = storageRef(storage, 'logos')
    const rootResult = await listAll(logosRoot)
    const folderResults = await Promise.all(
      rootResult.prefixes.map((folder) => listAll(folder))
    )
    const allItems = [
      ...rootResult.items,
      ...folderResults.flatMap((r) => r.items),
    ]
    const entries = await Promise.all(
      allItems.map(async (item) => {
        const url = await getDownloadURL(item)
        return [url, item.fullPath] as const
      })
    )
    const deduped = [...new Map(entries)]

    urlCache = deduped.map(([url]) => url)
    pathMap = new Map(deduped)
    cacheSet(CACHE_KEY, urlCache)
    cacheSet(PATH_KEY, Object.fromEntries(pathMap))

    // Warm browser cache with any new URLs
    warmBrowserCache(urlCache)
    preloaded = true
  } catch (err) {
    console.error('Logo preload failed:', err)
    preloaded = true
  }
}

/** Add a newly uploaded logo URL to the cache immediately */
export function addLogoToCache(url: string, path?: string) {
  urlCache = [url, ...urlCache.filter((u) => u !== url)]
  if (path) pathMap.set(url, path)
  cacheSet(CACHE_KEY, urlCache)
  cacheSet(PATH_KEY, Object.fromEntries(pathMap))
}

/** Remove a logo URL from the cache */
function removeLogoFromCache(url: string) {
  urlCache = urlCache.filter((u) => u !== url)
  pathMap.delete(url)
  cacheSet(CACHE_KEY, urlCache)
  cacheSet(PATH_KEY, Object.fromEntries(pathMap))
}

/** Delete a logo from Firebase Storage and remove from cache */
export async function deleteLogo(url: string): Promise<void> {
  const path = pathMap.get(url)
  if (path) {
    const storage = await getAppStorage()
    await deleteObject(storageRef(storage, path))
  }
  removeLogoFromCache(url)
  // Reset preload so next picker open fetches fresh list
  preloadPromise = null
  preloaded = false
}
