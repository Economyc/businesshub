import { defineConfig } from 'vite'
import { makeConfig } from './vite.config.base'

// App1 — BusinessHub (deploy a Oracle). Entrada index.html → dist/.
export default defineConfig(makeConfig({ outDir: 'dist', input: 'index.html' }))
