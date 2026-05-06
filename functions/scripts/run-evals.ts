/**
 * Eval runner offline para el agente AI de BusinessHub.
 *
 * Lee functions/evals/golden-questions.json y golpea el endpoint agentChat
 * corriendo en el emulator local. Valida cada respuesta streamed contra
 * mustInclude / mustNotInclude / expectedTools / requiresConfirmation y
 * reporta una tabla resumen con pass-rate por categoría.
 *
 * Uso (desde functions/):
 *   npm run build && firebase emulators:start --only functions   # en otra terminal
 *   npm run eval
 *
 * Variables opcionales:
 *   AGENT_URL    override del endpoint
 *   COMPANY_ID   override del companyId enviado (default TEST_COMPANY)
 *   PASS_RATE    threshold para exit code 0 (default 0.8)
 */

import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

interface GoldenQuestion {
  id: string
  category: string
  question: string
  expectedTools: string[]
  mustInclude: string[]
  mustNotInclude: string[]
  requiresConfirmation: boolean
}

interface GoldenSet {
  version: number
  description?: string
  questions: GoldenQuestion[]
}

interface EvalOutcome {
  id: string
  category: string
  pass: boolean
  reasons: string[]
  toolCalls: string[]
  textLength: number
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const AGENT_URL =
  process.env.AGENT_URL ?? 'http://localhost:5001/empresas-bf/us-central1/agentChat'
const COMPANY_ID = process.env.COMPANY_ID ?? 'TEST_COMPANY'
const PASS_RATE_THRESHOLD = Number.parseFloat(process.env.PASS_RATE ?? '0.8')

// Tokens del Vercel AI SDK Data Stream Protocol — usamos solo lo que importa.
// Formato: <tipo>:<json>\n  donde tipo: 0=text, 9=tool-call, a=tool-result, etc.
interface ParsedStream {
  text: string
  toolCalls: string[]
  rawLines: string[]
}

function tryJsonParse(input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

function parseDataStream(body: string): ParsedStream {
  const lines = body.split('\n').filter((l) => l.length > 0)
  let text = ''
  const toolCalls: string[] = []

  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx <= 0) continue
    const prefix = line.slice(0, colonIdx)
    const payload = line.slice(colonIdx + 1)
    const parsed = tryJsonParse(payload)

    // 0:"texto"  → chunk de texto del LLM
    if (prefix === '0' && typeof parsed === 'string') {
      text += parsed
      continue
    }

    // 9:{"toolCallId":"...","toolName":"getCashFlow",...}  → tool-call
    if (prefix === '9' && parsed && typeof parsed === 'object') {
      const tc = parsed as { toolName?: unknown }
      if (typeof tc.toolName === 'string') toolCalls.push(tc.toolName)
      continue
    }

    // 1:{"toolName":"..."} es la variante con nombre solamente en algunas versiones.
    if (prefix === '1' && parsed && typeof parsed === 'object') {
      const tc = parsed as { toolName?: unknown }
      if (typeof tc.toolName === 'string') toolCalls.push(tc.toolName)
    }
  }

  return { text, toolCalls, rawLines: lines }
}

async function runQuestion(q: GoldenQuestion): Promise<EvalOutcome> {
  const reasons: string[] = []
  let textLower = ''
  let toolCalls: string[] = []

  try {
    const res = await fetch(AGENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: q.question }],
        companyId: COMPANY_ID,
      }),
    })

    if (!res.ok) {
      reasons.push(`HTTP ${res.status}`)
      return { id: q.id, category: q.category, pass: false, reasons, toolCalls: [], textLength: 0 }
    }

    const body = await res.text()
    const parsed = parseDataStream(body)
    textLower = parsed.text.toLowerCase()
    toolCalls = parsed.toolCalls
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    reasons.push(`fetch error: ${msg}`)
    return { id: q.id, category: q.category, pass: false, reasons, toolCalls: [], textLength: 0 }
  }

  // mustInclude: al menos uno debe estar (lista OR — más tolerante a sinónimos como nómina/nomina)
  if (q.mustInclude.length > 0) {
    const found = q.mustInclude.some((kw) => textLower.includes(kw.toLowerCase()))
    if (!found) reasons.push(`missing any of mustInclude: [${q.mustInclude.join(', ')}]`)
  }

  // mustNotInclude: ninguno puede aparecer
  for (const kw of q.mustNotInclude) {
    if (textLower.includes(kw.toLowerCase())) reasons.push(`forbidden phrase present: "${kw}"`)
  }

  // expectedTools: al menos un match con lo invocado
  if (q.expectedTools.length > 0) {
    const matched = q.expectedTools.some((t) => toolCalls.includes(t))
    if (!matched) {
      reasons.push(
        `no expected tool called. expected one of [${q.expectedTools.join(
          ', '
        )}], got [${toolCalls.join(', ') || 'none'}]`
      )
    }
  } else if (toolCalls.length > 0) {
    // Para preguntas que NO deben usar tools (p.ej. identidad), penalizar uso de tools.
    reasons.push(`no tools expected but got [${toolCalls.join(', ')}]`)
  }

  // requiresConfirmation: la respuesta debe pedir confirmación explícita
  if (q.requiresConfirmation) {
    const askedConfirm =
      textLower.includes('confirm') ||
      textLower.includes('¿quieres') ||
      textLower.includes('¿deseas') ||
      textLower.includes('procedo')
    if (!askedConfirm) reasons.push('no confirmation prompt detected')
  }

  return {
    id: q.id,
    category: q.category,
    pass: reasons.length === 0,
    reasons,
    toolCalls,
    textLength: textLower.length,
  }
}

function formatRow(o: EvalOutcome): string {
  const status = o.pass ? 'PASS' : 'FAIL'
  const reason = o.pass ? '' : o.reasons.join(' | ')
  const tools = o.toolCalls.length ? o.toolCalls.join(',') : '-'
  return `${o.id.padEnd(14)} ${o.category.padEnd(14)} ${status.padEnd(5)} ${tools.padEnd(40)} ${reason}`
}

async function main(): Promise<void> {
  const path = resolve(__dirname, '..', 'evals', 'golden-questions.json')
  const raw = await readFile(path, 'utf-8')
  const set = JSON.parse(raw) as GoldenSet

  console.log(`\n[evals] running ${set.questions.length} golden questions against ${AGENT_URL}`)
  console.log(`[evals] companyId=${COMPANY_ID} threshold=${PASS_RATE_THRESHOLD}\n`)
  console.log(
    `${'id'.padEnd(14)} ${'category'.padEnd(14)} ${'res'.padEnd(5)} ${'tools'.padEnd(40)} reason`
  )
  console.log('-'.repeat(120))

  const outcomes: EvalOutcome[] = []
  // Ejecutamos secuencial para no saturar el emulator ni los rate limits del LLM.
  for (const q of set.questions) {
    const o = await runQuestion(q)
    outcomes.push(o)
    console.log(formatRow(o))
  }

  const total = outcomes.length
  const passed = outcomes.filter((o) => o.pass).length
  const passRate = total === 0 ? 0 : passed / total

  // Pass-rate por categoría
  const byCategory = new Map<string, { total: number; pass: number }>()
  for (const o of outcomes) {
    const acc = byCategory.get(o.category) ?? { total: 0, pass: 0 }
    acc.total += 1
    if (o.pass) acc.pass += 1
    byCategory.set(o.category, acc)
  }

  console.log('\n[evals] summary by category')
  console.log('-'.repeat(50))
  for (const [cat, stats] of [...byCategory.entries()].sort()) {
    const rate = stats.total === 0 ? 0 : stats.pass / stats.total
    console.log(
      `${cat.padEnd(16)} ${String(stats.pass).padStart(2)}/${String(stats.total).padEnd(2)}  ${(rate * 100).toFixed(1)}%`
    )
  }

  console.log('\n[evals] total')
  console.log('-'.repeat(50))
  console.log(`${passed}/${total}  ${(passRate * 100).toFixed(1)}%  threshold=${(PASS_RATE_THRESHOLD * 100).toFixed(1)}%`)

  if (passRate < PASS_RATE_THRESHOLD) {
    console.error(`\n[evals] FAIL — pass rate ${(passRate * 100).toFixed(1)}% < threshold`)
    process.exit(1)
  }
  console.log(`\n[evals] OK — pass rate ${(passRate * 100).toFixed(1)}% ≥ threshold`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[evals] fatal:', err)
  process.exit(1)
})
