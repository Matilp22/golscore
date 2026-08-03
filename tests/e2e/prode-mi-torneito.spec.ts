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
      /\/api\/prode\/|\/mi-torneito\/actions/.test(request.url())
    ) {
      requests.push(`${request.method()} ${request.url()}`)
    }
  })

  return requests
}

test.describe('Prode y Mi Torneito', () => {
  test('integra el Prode con datos reales y sin una segunda navegación', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    const unexpectedWrites = collectUnexpectedWrites(page)

    await page.goto('/prode', { waitUntil: 'domcontentloaded' })

    const shell = page.locator('.hf-prode-shell')
    await expect(
      shell.getByRole('heading', { name: 'Prode', level: 1 })
    ).toBeVisible()
    await expect(page.locator('.hf-global-header')).toHaveCount(1)
    await expect(page.locator('.hf-prode-header, .hf-prode-mobile-menu')).toHaveCount(0)
    await expect(
      shell.getByRole('navigation', { name: 'Secciones del Prode' })
    ).toBeVisible()
    await expect(
      shell.getByRole('link', { name: 'Torneos privados' })
    ).toHaveAttribute('href', '/prode/torneos')
    await expect(
      shell.getByRole('link', { name: 'Mundial 2026' })
    ).toHaveCount(0)

    const filters = shell.locator('.hf-prode-filters')
    await expect(filters).toBeVisible()
    await expect
      .poll(() => filters.locator('select').count())
      .toBeGreaterThanOrEqual(2)
    const leagueFilter = filters.getByLabel('Liga')
    await expect(leagueFilter).toBeVisible()
    if (await leagueFilter.isEnabled()) {
      await expect(leagueFilter).not.toHaveValue('')
    } else {
      // The isolated QA environment can legitimately have no synchronized
      // league catalog. The UI must expose that real empty state, not fixtures.
      await expect(leagueFilter).toHaveValue('')
    }
    await expect(filters.getByLabel('Fecha / Fase')).toBeVisible()
    await expect(
      shell.getByRole('heading', { name: 'Partidos', exact: true })
    ).toBeVisible()
    await expect(shell).not.toContainText('Cargando partidos...', {
      timeout: 15_000,
    })
    await expect(shell).not.toContainText('Cargando fecha...', {
      timeout: 15_000,
    })
    await expect(shell).not.toContainText('Cargando tabla del grupo...', {
      timeout: 15_000,
    })
    const lockedPrediction = shell.getByRole('button', { name: 'Bloqueado' }).first()
    if (await lockedPrediction.count()) {
      await expect(lockedPrediction).toBeDisabled()
    }

    await validateWidths(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await shell.screenshot({ path: testInfo.outputPath('prode-mobile.png') })
    await page.setViewportSize({ width: 1440, height: 900 })
    await shell.screenshot({ path: testInfo.outputPath('prode-desktop.png') })

    expect(unexpectedWrites).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('expone el estado privado del Prode sin mutar torneos', async ({ page }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    const unexpectedWrites = collectUnexpectedWrites(page)

    await page.goto('/prode/torneos', { waitUntil: 'domcontentloaded' })

    const shell = page.locator('.hf-prode-shell')
    await expect(
      shell.getByRole('heading', { name: 'Torneos', level: 1 })
    ).toBeVisible()
    await expect(shell).toContainText(
      'Iniciá sesión para crear torneos, solicitar acceso y ver rankings privados.'
    )
    await expect(page.locator('.hf-global-header')).toHaveCount(1)
    await validateWidths(page)

    expect(unexpectedWrites).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('muestra el estado real de Mi Torneito sin fixtures de demostración', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    const unexpectedWrites = collectUnexpectedWrites(page)

    await page.goto('/mi-torneito', { waitUntil: 'domcontentloaded' })

    const pageRoot = page.locator('.hf-mi-page')
    await expect(
      pageRoot.getByRole('heading', { name: 'Mi Torneito', level: 1 })
    ).toBeVisible()
    const tournamentBrowser = pageRoot.locator('.hf-mi-tournament-browser')
    await expect(tournamentBrowser).toBeVisible()
    await expect(
      tournamentBrowser.getByRole('searchbox', {
        name: 'Buscar torneo por nombre o ciudad',
      })
    ).toBeVisible()
    await expect(
      tournamentBrowser.locator('.hf-mi-section-head > span')
    ).toHaveText(/^\d+$/)
    await expect(
      pageRoot.getByRole('link', { name: 'Cómo funciona' })
    ).toHaveAttribute('href', '/mi-torneito/como-funciona')
    await expect(pageRoot).not.toContainText('Los Pibes FC')
    await expect(pageRoot).not.toContainText('La Banda')
    await expect(pageRoot).not.toContainText('2 - 1')

    const publishedTournament = pageRoot.locator(
      '.hf-mi-hero-featured, .hf-mi-tournament-card'
    ).first()
    if (await publishedTournament.count()) {
      const href = await publishedTournament.getAttribute('href')
      expect(href).toMatch(/^\/mi-torneito\/t\/[^/]+$/)

      await publishedTournament.click()
      await expect(page).toHaveURL(/\/mi-torneito\/t\/[^/]+$/)
      await expect(page.locator('.hf-mi-tournament-hero')).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Partidos', level: 2 })
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Posiciones', level: 2 })
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Equipos', level: 2 })
      ).toBeVisible()
      await expect(
        page.locator('.hf-mi-match-list, .hf-mi-empty').first()
      ).toBeVisible()
      await expect(
        page.locator('.hf-mi-table-wrap, .hf-mi-empty').first()
      ).toBeVisible()
      await expect(
        page.locator('.hf-mi-team-grid, .hf-mi-empty').first()
      ).toBeVisible()

      const teamLink = page.locator('.hf-mi-team-grid a').first()
      if (await teamLink.count()) {
        await teamLink.click()
        await expect(page).toHaveURL(/\/mi-torneito\/t\/[^/]+\/e\/[^/]+$/)
        await expect(
          page.locator('.hf-mi-team-title').getByRole('heading', { level: 1 })
        ).toBeVisible()
        await page.goto(href!, { waitUntil: 'domcontentloaded' })
      }

      const matchLink = page.locator('.hf-mi-match-row').first()
      if (await matchLink.count()) {
        await matchLink.click()
        await expect(page).toHaveURL(/\/mi-torneito\/t\/[^/]+\/p\/[^/]+$/)
        await expect(
          page.locator('.hf-mi-match-hero h1')
        ).toHaveText(/.+ vs .+/)
        await expect(page.locator('.hf-mi-detail-grid')).toBeVisible()
      }
    } else {
      await expect(tournamentBrowser.locator('.hf-mi-section-head > span')).toHaveText('0')
    }

    await page.goto('/mi-torneito', { waitUntil: 'domcontentloaded' })
    await validateWidths(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.hf-mi-utility-header').screenshot({
      path: testInfo.outputPath('mi-torneito-mobile.png'),
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.locator('.hf-mi-utility-header').screenshot({
      path: testInfo.outputPath('mi-torneito-desktop.png'),
    })

    expect(unexpectedWrites).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('valida el listado y el formulario de solicitud sin enviarlo', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    const unexpectedWrites = collectUnexpectedWrites(page)

    await page.goto('/mi-torneito/torneos', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('heading', { name: 'Torneos publicados', level: 1 })
    ).toBeVisible()
    await expect(
      page.locator('.hf-mi-card-grid, .hf-mi-empty')
    ).toBeVisible()
    await validateWidths(page)

    await page.goto('/mi-torneito/solicitar', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('heading', { name: 'Crear un torneo', level: 1 })
    ).toBeVisible()
    await expect(page.getByLabel('Tu nombre')).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email')
    await expect(page.getByLabel('Cantidad estimada de equipos')).toHaveAttribute(
      'min',
      '2'
    )
    await expect(
      page.getByRole('button', { name: 'Enviar solicitud' })
    ).toBeVisible()
    await validateWidths(page)

    expect(unexpectedWrites).toEqual([])
    expect(consoleErrors).toEqual([])
  })
})
