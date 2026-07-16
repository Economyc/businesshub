// Promise.all con tope de concurrencia. Nace del N+1 de subcolecciones `payments`
// en regenerateInvoiceSheet: un `Promise.all(txs.map(...))` sin tope abre un .get()
// por transacción gestionada a la vez, y eso corre dentro de la sección crítica
// del lock de la hoja (ver sheet-lock.ts) — cada segundo de más es un segundo en
// el que las demás regeneraciones responden `queued`.
//
// Preserva el orden de `items` en el resultado.

export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}
