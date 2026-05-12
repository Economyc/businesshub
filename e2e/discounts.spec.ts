import { test, expect, type Page } from '@playwright/test'

// Navega a `path` y espera a que el shell de la app monte. En un browser frío
// la carga inicial (JS + auth + compañías de Firestore vía túnel) puede tardar
// bastante, de ahí los timeouts generosos.
async function openApp(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  if (/\/login/.test(new URL(page.url()).pathname)) {
    throw new Error(
      'No autenticado: la sesión guardada (e2e/.auth/user.json) no se restauró. Borra ese archivo y vuelve a correr.',
    )
  }
  // El chip selector de compañía en el sidebar siempre se renderiza una vez la
  // app montó (no depende de permisos).
  await expect(page.locator('button[aria-haspopup="listbox"]')).toBeVisible({ timeout: 90_000 })
}

test.describe('Descuentos', () => {
  test('aparece en el sidebar de Finanzas, debajo de Cierres de Caja', async ({ page }) => {
    // En /discounts la sección "Finanzas" del sidebar queda expandida sola.
    await openApp(page, '/discounts')
    await expect(page.getByRole('heading', { level: 1, name: 'Descuentos' })).toBeVisible({ timeout: 60_000 })

    const discountsLink = page.getByRole('link', { name: 'Descuentos' })
    const closingsLink = page.getByRole('link', { name: 'Cierres de Caja' })
    if ((await discountsLink.count()) === 0 || (await closingsLink.count()) === 0) {
      test.skip(
        true,
        'El rol del usuario tester no tiene el permiso "Cierres de Caja" — habilítalo en Equipo → Roles para ver "Cierres de Caja" y "Descuentos" en el sidebar.',
      )
    }
    await expect(discountsLink).toBeVisible()
    await expect(closingsLink).toBeVisible()

    // Orden: "Cierres de Caja" debe ir antes que "Descuentos".
    const closingsBox = await closingsLink.boundingBox()
    const discountsBox = await discountsLink.boundingBox()
    expect(closingsBox && discountsBox && closingsBox.y < discountsBox.y).toBeTruthy()
    await page.screenshot({ path: 'test-results/discounts-sidebar.png', fullPage: true })

    // El link del sidebar navega a /discounts: vamos a Home y volvemos por él.
    await page.getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL(/\/home$/)
    if (!(await discountsLink.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Finanzas' }).click()
    }
    await discountsLink.click()
    await expect(page).toHaveURL(/\/discounts$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Descuentos' })).toBeVisible()
  })

  test('Cierres de Caja ya no tiene el tab "Descuentos"', async ({ page }) => {
    await openApp(page, '/closings')
    // En /closings, "Descuentos" ya no es una pestaña (botón). El único
    // "Descuentos" que podría existir es el link del sidebar, que es role=link.
    await expect(page.getByRole('button', { name: 'Descuentos' })).toHaveCount(0)
    await page.screenshot({ path: 'test-results/closings-sin-tab-descuentos.png', fullPage: true })
  })

  test('la foto es obligatoria para guardar un descuento', async ({ page }) => {
    await openApp(page, '/discounts')
    await expect(page.getByRole('heading', { level: 1, name: 'Descuentos' })).toBeVisible({ timeout: 60_000 })

    const form = page.locator('form').first()
    if ((await form.count()) === 0) {
      test.skip(true, 'El rol del usuario tester no tiene permiso de crear (closings.create) — no se renderiza el formulario.')
    }

    const guardar = page.getByRole('button', { name: 'Guardar Descuento' })
    await expect(guardar).toBeVisible()
    await expect(guardar).toBeDisabled()

    // Tipo (SelectInput custom: trigger button + dropdown de opciones)
    await form.locator('label:text-is("Tipo") + div button').first().click()
    await form.locator('label:text-is("Tipo") + div').getByRole('button', { name: 'Cortesia (100%)' }).click()
    // Monto
    await page.locator('input[name="amount"]').fill('50000')
    // Motivo
    await form.locator('label:text-is("Motivo") + div button').first().click()
    await form.locator('label:text-is("Motivo") + div').getByRole('button', { name: 'Socio', exact: true }).click()
    // Autorizado por
    await page.getByPlaceholder('Nombre del manager').fill('Tester E2E')

    // Todo lleno menos la foto -> el botón sigue deshabilitado.
    await expect(guardar).toBeDisabled()
    await page.screenshot({ path: 'test-results/discounts-form-sin-foto.png', fullPage: true })

    // Adjuntar foto al <input type=file> oculto -> se habilita.
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/sample-discount.png')
    await expect(guardar).toBeEnabled()
    await page.screenshot({ path: 'test-results/discounts-form-con-foto.png', fullPage: true })
  })

  test('crear un descuento con foto lo sube a Drive y se puede borrar', async ({ page }) => {
    test.skip(process.env.E2E_WRITE !== '1', 'Escribe datos reales en producción — correr con E2E_WRITE=1 para incluirlo.')
    const photoPath = process.env.E2E_PHOTO ?? 'e2e/fixtures/sample-discount.png'
    await openApp(page, '/discounts')
    await expect(page.getByRole('heading', { level: 1, name: 'Descuentos' })).toBeVisible({ timeout: 60_000 })
    const form = page.locator('form').first()
    if (!(await form.isVisible({ timeout: 30_000 }).catch(() => false))) {
      test.skip(true, 'No se renderiza el formulario (sin permiso closings.create, o la página no cargó a tiempo).')
    }

    const detalle = `E2E ${Date.now()}`
    await form.locator('label:text-is("Tipo") + div button').first().click()
    await form.locator('label:text-is("Tipo") + div').getByRole('button', { name: 'Cortesia (100%)' }).click()
    await page.locator('input[name="amount"]').fill('1000')
    await form.locator('label:text-is("Motivo") + div button').first().click()
    await form.locator('label:text-is("Motivo") + div').getByRole('button', { name: 'Socio', exact: true }).click()
    await page.getByPlaceholder('Nombre, producto, contexto...').fill(detalle)
    await page.getByPlaceholder('Nombre del manager').fill('Tester E2E')
    await page.locator('input[type="file"]').setInputFiles(photoPath)

    await page.getByRole('button', { name: 'Guardar Descuento' }).click()

    // Precondiciones que dependen de la config de la compañía / cuenta:
    //  - el usuario logueado debe tener su Drive conectado (Ajustes → Compañías)
    //  - la compañía activa debe tener "Carpeta de Descuentos" configurada
    // Si falta alguna, el callable devuelve un error visible -> skip con la causa.
    const driveNotConnected = page.getByText(/no has conectado tu drive/i)
    const noDiscountsFolder = page.getByText(/carpeta de Descuentos configurada/i)
    if (await driveNotConnected.isVisible({ timeout: 10_000 }).catch(() => false)) {
      test.skip(true, `El usuario logueado (${process.env.E2E_USER}) no tiene su Drive conectado: Ajustes → Compañías → "Conectar Drive".`)
    }
    if (await noDiscountsFolder.isVisible().catch(() => false)) {
      test.skip(true, 'La compañía activa no tiene "Carpeta de Descuentos" configurada en Ajustes → Compañías.')
    }

    const row = page.locator('table tr', { hasText: detalle }).first()
    await expect(row).toBeVisible({ timeout: 30_000 })
    const photoLink = row.getByRole('link')
    await expect(photoLink).toHaveAttribute('href', /drive\.google\.com/)
    await page.screenshot({ path: 'test-results/discounts-creado.png', fullPage: true })

    // Cleanup: borrar el descuento recién creado.
    await row.getByRole('button').last().click() // botón eliminar
    await page.getByRole('button', { name: /eliminar/i }).last().click() // ConfirmDialog
    await expect(page.locator('table tr', { hasText: detalle })).toHaveCount(0, { timeout: 20_000 })
  })
})
