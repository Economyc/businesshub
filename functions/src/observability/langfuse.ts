import { Langfuse } from 'langfuse'

let cachedClient: Langfuse | null = null
let warned = false

export function getLangfuseClient(): Langfuse | null {
  if (cachedClient) return cachedClient
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY
  const baseUrl = process.env.LANGFUSE_BASE_URL
  if (!publicKey || !secretKey || !baseUrl) {
    if (!warned) {
      console.warn('[langfuse] keys not configured, skipping observability')
      warned = true
    }
    return null
  }
  cachedClient = new Langfuse({
    publicKey,
    secretKey,
    baseUrl,
    flushAt: 1,
    flushInterval: 1000,
  })
  console.log('[langfuse] client initialized, baseUrl=' + baseUrl + ' pkLen=' + publicKey.length + ' skLen=' + secretKey.length)
  // Log internal client config to detect mismatches
  const anyClient = cachedClient as unknown as Record<string, unknown>
  if (anyClient.baseUrl) console.log('[langfuse] internal baseUrl=' + String(anyClient.baseUrl))
  return cachedClient
}

/** Best-effort flush; tolerates SDK API differences (flushAsync vs flush vs shutdownAsync). */
export async function flushLangfuse(client: Langfuse | null | undefined): Promise<void> {
  if (!client) return
  try {
    const anyClient = client as unknown as Record<string, unknown>
    // Prefer shutdownAsync: drains queue + waits for network. Required for
    // Cloud Functions where the container may be frozen after res.send().
    if (typeof anyClient.shutdownAsync === 'function') {
      await (anyClient.shutdownAsync as () => Promise<void>)()
      cachedClient = null  // force fresh client on next invocation
      console.log('[langfuse] shutdownAsync OK')
      return
    }
    if (typeof anyClient.flushAsync === 'function') {
      await (anyClient.flushAsync as () => Promise<void>)()
      console.log('[langfuse] flushAsync OK')
      return
    }
    if (typeof anyClient.flush === 'function') {
      await Promise.resolve((anyClient.flush as () => unknown)())
      console.log('[langfuse] flush() OK')
    }
  } catch (err) {
    console.warn('[langfuse] flush failed:', err instanceof Error ? err.message : err)
  }
}
