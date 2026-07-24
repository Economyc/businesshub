import { defineConfig } from 'vitest/config'

// Config separada de `vitest.config.ts` a proposito: los tests de reglas corren
// en Node (no jsdom), hablan con los emuladores de Firestore/Storage y no
// necesitan el setup de React Testing Library ni el plugin de Vite.
//
// Se ejecuta via `npm run test:rules`, que levanta los emuladores primero.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // Las suites comparten el mismo emulador: en paralelo se pisan los datos
    // sembrados. Un solo worker mantiene el aislamiento entre archivos.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
