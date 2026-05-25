import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { loadEnv, type Plugin, type UserConfig } from 'vite'

// Config compartida entre las dos apps del monorepo (App1 = BusinessHub en
// Oracle, App2 = herramienta admin en Hetzner). Ambas comparten `src/`, plugins,
// alias y la estrategia de manualChunks. Lo único que cambia por app es el
// `outDir` (deploy independiente a servers distintos) y el HTML de entrada.
// Usamos `process.cwd()` (no `__dirname`) porque Vite siempre se invoca desde la
// raíz del proyecto y así evitamos el `__dirname` indefinido en módulos ESM
// importados (este archivo no es el config principal, es un helper).
const root = process.cwd()

// Espejo de los campos que `src/core/firebase/config.ts` consume. Si alguna
// falta en build, Vite las inlinea como `undefined` y producción arranca con
// `apiKey: void 0` → Firebase lanza `auth/invalid-api-key` y la app queda en
// pantalla blanca (ya pasó en prod una vez con un deploy sin `.env.local`).
const REQUIRED_FIREBASE_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

// Aborta `vite build` si falta cualquier VITE_FIREBASE_*: falla ruidosa en vez
// de publicar un bundle roto. `loadEnv` resuelve los `.env*` Y las vars de
// `process.env` con prefijo VITE_, así cubre App1 (deploy local con .env.local)
// y App2 (Dockerfile.admin las inyecta como ENV vía Coolify). Solo corre en
// build: `dev`/vitest no se ven afectados.
function validateFirebaseEnv(): Plugin {
  return {
    name: 'validate-firebase-env',
    config(_config, { command, mode }) {
      if (command !== 'build') return
      const env = loadEnv(mode, root)
      const missing = REQUIRED_FIREBASE_ENV.filter((key) => !env[key])
      if (missing.length > 0) {
        throw new Error(
          `[build abortado] Faltan variables VITE_FIREBASE_* requeridas:\n` +
            missing.map((key) => `  - ${key}`).join('\n') +
            `\nCopia .env.local (gitignoreado, ver .env.example) o define los ` +
            `build args antes de compilar.`,
        )
      }
    },
  }
}

export function makeConfig({
  outDir,
  input,
}: {
  outDir: string
  input: string
}): UserConfig {
  return {
    plugins: [validateFirebaseEnv(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(root, './src'),
      },
    },
    build: {
      outDir,
      rollupOptions: {
        input: path.resolve(root, input),
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
  }
}
