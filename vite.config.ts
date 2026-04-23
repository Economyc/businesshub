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
          'firebase-vendor': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/functions',
            'firebase/storage',
          ],
          // recharts NO va aqui: al agruparlo en chunk fijo, Vite lo marca
          // como modulepreload en index.html (400K descargados al boot aunque
          // solo lo usen dashboards lazy). Dejandolo sin manualChunk, Rollup
          // lo empaqueta con el chunk del modulo que lo importa (analytics/*,
          // home kpi charts) y solo carga cuando el usuario abre esa ruta.
          motion: ['framer-motion'],
          radix: ['@radix-ui/react-tooltip', '@base-ui/react'],
        },
      },
    },
  },
})
