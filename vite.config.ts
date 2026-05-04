import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // firebase-vendor solo lleva lo que se usa al boot (app, auth,
          // firestore). functions y storage estan en lazy getters dentro de
          // config.ts (`getAppFunctions`, `getAppStorage`) para que Rollup los
          // ponga en chunks separados, cargados solo cuando un modulo lazy
          // (agent, pos-sync, talent, settings) los necesita.
          'firebase-vendor': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
          ],
          // recharts NO va aqui: al agruparlo en chunk fijo, Vite lo marca
          // como modulepreload en index.html (400K descargados al boot aunque
          // solo lo usen dashboards lazy). Dejandolo sin manualChunk, Rollup
          // lo empaqueta con el chunk del modulo que lo importa (analytics/*,
          // home kpi charts) y solo carga cuando el usuario abre esa ruta.
          // framer-motion SI va aqui: 39 modulos lo usan, varios en el entry
          // path (page-transition, confirm-dialog, command-palette, mobile-nav,
          // kpi-card). Sin manualChunk, framer se mergea al chunk del entry y
          // se pierde cache entre deploys (cambia con cada release de codigo).
          // Cuando se lazy-carguen page-transition + dialogs en oleada futura,
          // reevaluar si vale quitar este entry.
          motion: ['framer-motion'],
          radix: ['@radix-ui/react-tooltip', '@base-ui/react'],
          // lucide-react se usa desde el primer render (sidebar, topbar, login,
          // mobile-nav, home). Agruparlo en chunk fijo evita que cada modulo
          // empaquete su propia copia de los iconos compartidos. Tree-shaking
          // sigue activo: solo entran al chunk los iconos realmente importados.
          lucide: ['lucide-react'],
        },
      },
    },
  },
})
