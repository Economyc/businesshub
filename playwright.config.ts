import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// Las credenciales del tester y (opcional) E2E_BASE_URL viven en .env.e2e
// (gitignoreado). Playwright no auto-carga .env, así que lo hacemos acá.
dotenv.config({ path: '.env.e2e' })

const baseURL = process.env.E2E_BASE_URL ?? 'https://businesshub.myvnc.com'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  // El sitio está detrás de un túnel + Firestore tarda en bajar las compañías
  // en un browser frío (~20-30s) — por eso los timeouts generosos.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
    },
  ],
})
