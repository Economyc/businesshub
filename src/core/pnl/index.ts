// Motor de P&L compartido por el generador de informes (Node) y la app (Vite).
//
// Los re-exports llevan extension `.ts` explicita a proposito: es lo que permite
// que `node scripts/informe-mensual-negocios.mjs` importe este barrel sin
// loader ni transpilador (type stripping nativo, Node >= 22.18). Ver
// contract.test.ts, que falla si alguien la quita.

export * from './text.ts'
export * from './lines.ts'
export * from './month.ts'
// La tabla de sedes NO vive aqui: identifica el negocio y el repo es publico.
// Esta en scripts/lib/closing-companies.mjs, fuera de git.
export * from './types.ts'
export * from './statement.ts'
export * from './bridge.ts'
export * from './deferrals.ts'
export * from './missing.ts'
export * from './closing.ts'
