import { expect, test, type Page } from '@playwright/test'

import { prepareReadOnlyPage } from './read-only-page'

const RESPONSIVE_WIDTHS = [
  320, 360, 390, 412, 430, 768, 820, 1024, 1280, 1366, 1440, 1920,
]

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
}

async function validateWidths(page: Page) {
  for (const width of RESPONSIVE_WIDTHS) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 })
    await expectNoOverflow(page)
  }
}

function collectUnexpectedWrites(page: Page) {
  const requests: string[] = []

  page.on('request', (request) => {
    if (
      request.method() !== 'GET' &&
      /\/api\/admin\/|\/api\/prode\/|\/mi-torneito\/actions/.test(request.url())
    ) {
      requests.push(`${request.method()} ${request.url()}`)
    }
  })

  return requests
}

test.describe('Accesos administrativos', () => {
  test('presenta el login admin separado y no ejecuta acciones', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    const unexpectedWrites = collectUnexpectedWrites(page)

    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })

    const login = page.locator('.hf-admin-login')
    await expect(login).toBeVisible()
    await expect(page.locator('.hf-global-header')).toHaveCount(0)
    await expect(login).toContainText('La trastienda del partido.')
    await expect(
      page.locator('meta[name="robots"]')
    ).toHaveAttribute('content', /noindex/)

    const heading = login.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    if ((await heading.textContent())?.includes('Iniciar sesión')) {
      await expect(login.getByLabel('Email')).toHaveAttribute(
        'autocomplete',
        'email'
      )
      await expect(login.getByLabel('Contraseña')).toHaveAttribute(
        'autocomplete',
        'current-password'
      )
      await expect(
        login.getByRole('button', { name: 'Iniciar sesión' })
      ).toBeVisible()
    }

    await validateWidths(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await login.screenshot({ path: testInfo.outputPath('admin-login-mobile.png') })
    await page.setViewportSize({ width: 1440, height: 900 })
    await login.screenshot({ path: testInfo.outputPath('admin-login-desktop.png') })

    expect(unexpectedWrites).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('protege el dashboard con redirección o cierre seguro', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    const unexpectedWrites = collectUnexpectedWrites(page)

    await page.goto('/admin', { waitUntil: 'domcontentloaded' })

    if (page.url().endsWith('/admin/login')) {
      await expect(page.locator('.hf-admin-login')).toBeVisible()
    } else {
      await expect(page).toHaveURL(/\/admin$/)
      await expect(page.locator('.hf-admin-standalone')).toBeVisible()
      await expect(
        page.locator('.hf-admin-standalone [role="alert"]')
      ).toContainText('Admin no configurado')
    }
    await expect(page.locator('.hf-admin-shell')).toHaveCount(0)
    await expectNoOverflow(page)

    expect(unexpectedWrites).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('muestra el acceso del organizador sin inventar permisos', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    const unexpectedWrites = collectUnexpectedWrites(page)

    await page.goto('/mi-torneito/admin', { waitUntil: 'domcontentloaded' })

    const pageRoot = page.locator('.hf-mi-page')
    await expect(pageRoot).toBeVisible()
    await expect(
      pageRoot.getByRole('heading', { name: 'Iniciá sesión', level: 1 })
    ).toBeVisible()
    await expect(pageRoot.getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/login'
    )

    await validateWidths(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await pageRoot.screenshot({
      path: testInfo.outputPath('mi-torneito-admin-mobile.png'),
    })

    expect(unexpectedWrites).toEqual([])
    expect(consoleErrors).toEqual([])
  })
})
