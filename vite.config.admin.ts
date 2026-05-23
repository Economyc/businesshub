import { defineConfig } from 'vite'
import { makeConfig } from './vite.config.base'

// App2 — herramienta admin (deploy a Hetzner). Entrada admin.html → dist-admin/.
// Build con: `vite build --config vite.config.admin.ts` (ver script build:admin).
export default defineConfig(makeConfig({ outDir: 'dist-admin', input: 'admin.html' }))
