// Wave 4.1 — Backfill de embeddings para contratos pre-existentes.
//
// Itera companies/{companyId}/contracts/* y llama indexContract() para los que
// aún no tengan documento padre en contractEmbeddings/. NO se ejecuta en CI.
//
// Uso (cuando se quiera correr):
//   GEMINI_API_KEY=... GOOGLE_APPLICATION_CREDENTIALS=... \
//     npx tsx functions/scripts/backfill-contract-embeddings.ts
//
// Flags opcionales:
//   --force      reindexa aunque ya exista doc padre
//   --company X  limita a una company específica

import { indexContract } from '../src/contracts-indexer.js'
import { db } from '../src/firestore.js'

interface Args {
  force: boolean
  company?: string
}

function parseArgs(argv: string[]): Args {
  const out: Args = { force: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--force') out.force = true
    else if (a === '--company') out.company = argv[++i]
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const companies = args.company
    ? [{ id: args.company } as { id: string }]
    : (await db.collection('companies').get()).docs.map((d) => ({ id: d.id }))

  console.log(`[backfill] companies: ${companies.length}`)

  let total = 0
  let indexed = 0
  let skipped = 0
  let failed = 0

  for (const company of companies) {
    const contracts = await db
      .collection('companies')
      .doc(company.id)
      .collection('contracts')
      .get()
    console.log(`[backfill] ${company.id}: ${contracts.size} contracts`)

    for (const c of contracts.docs) {
      total++
      try {
        if (!args.force) {
          const parent = await db
            .collection('companies')
            .doc(company.id)
            .collection('contractEmbeddings')
            .doc(c.id)
            .get()
          if (parent.exists) {
            skipped++
            continue
          }
        }
        const result = await indexContract(
          company.id,
          c.id,
          c.data() as Record<string, unknown>,
        )
        indexed++
        console.log(
          `[backfill]   ${company.id}/${c.id} → ${result.chunks} chunks (${indexed}/${total})`,
        )
      } catch (error) {
        failed++
        console.error(`[backfill]   FAILED ${company.id}/${c.id}:`, error)
      }
    }
  }

  console.log(
    `[backfill] done. total=${total} indexed=${indexed} skipped=${skipped} failed=${failed}`,
  )
}

main().catch((err) => {
  console.error('[backfill] fatal:', err)
  process.exit(1)
})
