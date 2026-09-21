// Blinda el contrato que hace a src/core/pnl/ consumible por Node Y por Vite
// sin ningun tooling: `node scripts/informe-mensual-negocios.mjs` importa estos
// .ts directo (type stripping nativo, Node >= 22.18).
//
// Si alguien rompe una de estas reglas, el navegador sigue compilando y el
// script revienta en el cierre mensual. Este test lo caza antes.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const DIR = join(process.cwd(), 'src', 'core', 'pnl')

const sourceFiles = readdirSync(DIR)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .map((f) => ({ name: f, code: readFileSync(join(DIR, f), 'utf8') }))

/** Todas las sentencias `import ... from '...'`, con su clausula completa. */
function importsOf(code: string): { clause: string; spec: string }[] {
  const out: { clause: string; spec: string }[] = []
  const re = /import\s+([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) out.push({ clause: m[1], spec: m[2] })
  // `export * from '...'` y `export { x } from '...'` resuelven igual que un import.
  const re2 = /export\s+(?:\*|\{[\s\S]*?\})\s*from\s*['"]([^'"]+)['"]/g
  while ((m = re2.exec(code)) !== null) out.push({ clause: '', spec: m[1] })
  return out
}

describe('contrato de src/core/pnl (dual Node + navegador)', () => {
  it('encuentra los archivos del motor', () => {
    expect(sourceFiles.length).toBeGreaterThan(5)
  })

  it.each(sourceFiles)('$name: los imports relativos llevan extension .ts', ({ code }) => {
    const offenders = importsOf(code)
      .filter((i) => i.spec.startsWith('.'))
      .filter((i) => !i.spec.endsWith('.ts'))
      .map((i) => i.spec)
    // Node resuelve especificadores relativos literalmente: sin extension da
    // ERR_MODULE_NOT_FOUND al correr el script.
    expect(offenders).toEqual([])
  })

  it.each(sourceFiles)('$name: el alias @/ solo aparece en `import type`', ({ code }) => {
    const offenders = importsOf(code)
      .filter((i) => i.spec.startsWith('@/'))
      .filter((i) => !/^\s*type\b/.test(i.clause))
      .map((i) => i.spec)
    // `import type` se borra antes de resolver, asi que el alias nunca se toca.
    // Un import de valor con @/ revienta en Node (no hay resolver de alias).
    expect(offenders).toEqual([])
  })

  it.each(sourceFiles)('$name: sin sintaxis TS no borrable (enum / namespace)', ({ code }) => {
    const stripped = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(stripped).not.toMatch(/\b(?:const\s+)?enum\s+\w/)
    expect(stripped).not.toMatch(/\bnamespace\s+\w/)
  })

  it.each(sourceFiles)('$name: sin dependencias de firebase, DOM ni process', ({ code }) => {
    const specs = importsOf(code).map((i) => i.spec)
    expect(specs.filter((s) => s.startsWith('firebase'))).toEqual([])
    expect(specs.filter((s) => s.startsWith('node:'))).toEqual([])
    const stripped = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(stripped).not.toMatch(/\bprocess\.\w/)
    expect(stripped).not.toMatch(/\b(?:document|window)\.\w/)
  })
})
