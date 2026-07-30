import { expect, test, type Page } from '@playwright/test'

import { prepareReadOnlyPage } from './read-only-page'

const RESPONSIVE_WIDTHS = [320, 360, 390, 412, 430, 768, 820, 1024, 1280, 1366, 1440, 1920]

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

test.describe('Cuenta, favoritos y notificaciones', () => {
  test('presenta acceso y registro seguros sin mutar Auth durante QA', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    const authMutationRequests: string[] = []

    page.on('request', (request) => {
      if (
        request.method() !== 'GET' &&
        /\/auth\/v1\/(signup|token|recover|user)/.test(request.url())
      ) {
        authMutationRequests.push(`${request.method()} ${request.url()}`)
      }
    })

    await page.goto('/login?next=https%3A%2F%2Fejemplo.com', {
      waitUntil: 'domcontentloaded',
    })
    const login = page.locator('.hf-account-access')
    await expect(login.getByRole('heading', { name: 'Iniciar sesión', level: 1 })).toBeVisible()
    await expect(login.getByLabel('Email')).toHaveAttribute('autocomplete', 'email')
    await expect(login.getByLabel('Contraseña')).toHaveAttribute(
      'autocomplete',
      'current-password'
    )

    await login.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click()
    await expect(login.getByRole('alert')).toContainText(
      'Ingresá tu email'
    )
    await expect(
      login.getByRole('link', { name: 'Crear cuenta' })
    ).toHaveAttribute('href', '/register?next=%2Fprode')

    await page.setViewportSize({ width: 390, height: 844 })
    await login.screenshot({ path: testInfo.outputPath('login-mobile.png') })
    await page.setViewportSize({ width: 1440, height: 900 })
    await login.screenshot({ path: testInfo.outputPath('login-desktop.png') })

    await page.goto('/register?next=%2Fperfil', { waitUntil: 'domcontentloaded' })
    const register = page.locator('.hf-account-access')
    await expect(
      register.getByRole('heading', { name: 'Crear una cuenta', level: 1 })
    ).toBeVisible()
    await register.getByLabel('Nombre de usuario').fill('ab ')
    await register.getByLabel('Email').fill('qa-local@hayfulbo.test')
    await register.getByLabel('Contraseña').fill('abcdef')
    await register.getByRole('button', { name: 'Crear cuenta' }).click()
    await expect(register.getByRole('alert')).toContainText(
      'al menos 3 caracteres'
    )
    await expect(
      register.getByRole('link', { name: 'Iniciar sesión' })
    ).toHaveAttribute('href', '/login?next=%2Fperfil')

    await validateWidths(page)
    expect(authMutationRequests).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('explica un enlace de recuperación inválido sin error técnico', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/restablecer-contrasena', { waitUntil: 'domcontentloaded' })
    const recovery = page.locator('.hf-account-access')
    await expect(
      recovery.getByRole('heading', {
        name: 'Necesitás un enlace nuevo',
        level: 1,
      })
    ).toBeVisible()
    await expect(recovery.getByRole('alert')).toContainText(
      'inválido o expiró'
    )
    await expect(
      recovery.getByRole('link', { name: 'Solicitar un nuevo enlace' })
    ).toHaveAttribute('href', '/login')
    await validateWidths(page)
    expect(consoleErrors).toEqual([])
  })

  test('muestra perfil sin sesión y conserva navegación a Auth', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/perfil', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('heading', { name: 'Tu lugar en Hay Fulbo', level: 1 })
    ).toBeVisible()
    const signedOut = page.locator('.hf-profile-signed-out')
    await expect(
      signedOut.getByRole('heading', {
        name: /Iniciá sesión para ver tu perfil|No pudimos comprobar tu sesión/,
      })
    ).toBeVisible()
    await expect(
      signedOut.getByRole('link', { name: 'Iniciar sesión' })
    ).toHaveAttribute('href', '/login?next=%2Fperfil')
    await expect(
      signedOut.getByRole('link', { name: 'Crear cuenta' })
    ).toHaveAttribute('href', '/register?next=%2Fperfil')

    await validateWidths(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.hf-profile-page').screenshot({
      path: testInfo.outputPath('profile-signed-out-mobile.png'),
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.locator('.hf-profile-page').screenshot({
      path: testInfo.outputPath('profile-signed-out-desktop.png'),
    })
    expect(consoleErrors).toEqual([])
  })

  test('reúne favoritos locales y permite quitarlos desde mobile y desktop', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'hf:favorites:teams:v1',
        JSON.stringify([
          {
            id: '451',
            name: 'Boca Juniors',
            href: '/equipo/451',
            createdAt: '2026-07-30T12:00:00.000Z',
          },
        ])
      )
      window.localStorage.setItem(
        'fulboapp:favorites:v1',
        JSON.stringify(['argentina-liga-profesional'])
      )
    })

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Favoritos en Hay Fulbo' }).click()
    const dialog = page.getByRole('dialog', { name: 'Tus favoritos' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Boca Juniors' })).toBeVisible()
    await expect(dialog.locator('.hf-favorite-competition-list')).toContainText(
      'Liga Profesional'
    )

    await dialog
      .getByRole('button', { name: 'Quitar Boca Juniors de favoritos' })
      .click()
    await expect(dialog.locator('.hf-favorite-teams-empty')).toBeVisible()
    await dialog
      .getByRole('button', { name: /Quitar .* de favoritos/ })
      .click()
    await expect(dialog.locator('.hf-favorite-competitions-empty')).toBeVisible()

    expect(
      await page.evaluate(() => window.localStorage.getItem('hf:favorites:teams:v1'))
    ).toBe('[]')
    expect(
      await page.evaluate(() => window.localStorage.getItem('fulboapp:favorites:v1'))
    ).toBe('[]')

    await dialog.getByRole('button', { name: 'Cerrar Tus favoritos' }).click()
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: 'Abrir equipos favoritos' }).click()
    await expect(page.getByRole('dialog', { name: 'Tus favoritos' })).toBeVisible()
    await expectNoOverflow(page)
    expect(consoleErrors).toEqual([])
  })

  test('muestra recordatorios reales en la campana y persiste lectura', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.route('**/api/global-actions-data', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: '2026-07-30T12:00:00.000Z',
          teams: [],
          competitions: [],
          matches: [],
          liveEvents: [],
          pages: [],
        }),
      })
    })
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'hf:match-reminders:v1',
        JSON.stringify([
          {
            matchId: 'qa-reminder',
            href: '/partido/qa-reminder',
            home: 'Equipo local',
            away: 'Equipo visitante',
            displayTime: '21:00',
            status: 'Programado',
            createdAt: '2026-07-30T12:00:00.000Z',
          },
        ])
      )
    })

    await page.goto('/noticias', { waitUntil: 'domcontentloaded' })
    const bell = page.getByRole('button', { name: /Notificaciones/ })
    await expect(bell).toHaveAttribute('aria-label', /1 sin leer/)
    await bell.click()
    const dialog = page.getByRole('dialog', { name: 'Notificaciones' })
    await expect(dialog).toBeFocused()
    await expect(dialog).toContainText('Equipo local vs Equipo visitante')
    await dialog.getByRole('button', { name: 'Marcar leídas' }).click()
    await expect(bell).toHaveAttribute('aria-label', 'Notificaciones')
    expect(
      JSON.parse(
        (await page.evaluate(() =>
          window.localStorage.getItem('hf:notifications:read:v1')
        )) ?? '[]'
      )
    ).toContain('reminder:qa-reminder')

    await dialog.getByRole('button', { name: 'Limpiar' }).click()
    await expect(dialog).toContainText('Sin novedades por ahora')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(bell).toBeFocused()
    expect(consoleErrors).toEqual([])
  })
})
