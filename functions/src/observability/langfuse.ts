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
  return cachedClient
}

/** Best-effort flush; tolerates SDK API differences (flushAsync vs flush vs shutdownAsync). */
export async function flushLangfuse(client: Langfuse | null | undefined): Promise<void> {
  if (!client) return
  try {
    const anyClient = client as unknown as Record<string, unknown>
    if (typeof anyClient.flushAsync === 'function') {
      await (anyClient.flushAsync as () => Promise<void>)()
      return
    }
    if (typeof anyClient.shutdownAsync === 'function') {
      await (anyClient.shutdownAsync as () => Promise<void>)()
      return
    }
    if (typeof anyClient.flush === 'function') {
      await Promise.resolve((anyClient.flush as () => unknown)())
    }
  } catch (err) {
    console.warn('[langfuse] flush failed:', err)
  }
}
