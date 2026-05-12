import { test as setup, expect } from '@playwright/test'

const AUTH_FILE = 'e2e/.auth/user.json'

setup('autenticar usuario tester', async ({ page }) => {
  const email = process.env.E2E_USER
  const password = process.env.E2E_PASS
  if (!email || !password) {
    throw new Error('Falta E2E_USER / E2E_PASS. Copia .env.e2e.example a .env.e2e y completa las credenciales del tester.')
  }

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  // Tras login, react-router manda a "/" (selector de compañía). Si solo hay
  // una compañía, redirige solo a /home; si hay varias, hay que elegir una.
  await page.waitForURL((url) => !/\/login/.test(url.pathname), { timeout: 20_000, waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/correo o contraseña incorrectos/i)).toHaveCount(0)

  if (!/\/home/.test(page.url())) {
    // Página selector de compañía: cada compañía es un <button> que contiene
    // "Ventas hoy". El primer load baja las compañías de Firestore (lento).
    const companyCard = page.locator('button:has-text("Ventas hoy")').first()
    await companyCard.waitFor({ state: 'visible', timeout: 60_000 })
    await companyCard.click()
  }
  await page.waitForURL('**/home', { timeout: 60_000, waitUntil: 'domcontentloaded' })
  // Dar tiempo a que Firestore vuelque su cache persistente (IndexedDB) para que
  // los specs que reusan este storageState carguen las compañías al instante.
  await page.waitForTimeout(3_000)

  // Guarda cookies + localStorage + IndexedDB (Firebase Auth persiste la sesión
  // en IndexedDB, así que indexedDB:true es imprescindible).
  await page.context().storageState({ path: AUTH_FILE, indexedDB: true })
})
