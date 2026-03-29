const PREFIX = 'bh:'

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function cacheSet(key: string, data: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data))
  } catch {
    // localStorage full or unavailable — ignore
  }
}

export function cacheDel(key: string): void {
  localStorage.removeItem(PREFIX + key)
}
