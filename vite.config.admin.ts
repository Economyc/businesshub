import { defineConfig, type Plugin } from 'vite'
import { makeConfig } from './vite.config.base'

// En dev, cualquier ruta HTML (/horarios, /marcar/:token...) sirve admin.html,
// igual que el fallback SPA de nginx en produccion. Sin esto el dev server cae
// al index.html de App1 al recargar o abrir un link directo.
function adminSpaFallback(): Plugin {
  return {
    name: 'admin-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? ''
        if (req.headers.accept?.includes('text/html') && !url.startsWith('/@') && !url.includes('.')) {
          req.url = '/admin.html'
        }
        next()
      })
    },
  }
}

// App2 — herramienta admin (deploy a Hetzner). Entrada admin.html → dist-admin/.
// Build con: `vite build --config vite.config.admin.ts` (ver script build:admin).
// Dev con rutas directas: `vite --config vite.config.admin.ts --port 5174`.
const base = makeConfig({ outDir: 'dist-admin', input: 'admin.html' })
export default defineConfig({ ...base, plugins: [...(base.plugins ?? []), adminSpaFallback()] })
