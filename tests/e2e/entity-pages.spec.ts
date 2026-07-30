import { expect, test, type Page } from '@playwright/test'

import { prepareReadOnlyPage } from './read-only-page'

const RESPONSIVE_VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1024, height: 900 },
  { width: 1280, height: 900 },
  { width: 1366, height: 900 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
}

async function validateResponsiveMatrix(page: Page) {
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await expectNoDocumentOverflow(page)
  }
}

async function expectEntityMediaFits(page: Page) {
  const mark = await page.locator('.hf-entity-mark').boundingBox()
  const media = await page.locator('.hf-entity-mark > span').boundingBox()

  expect(mark).not.toBeNull()
  expect(media).not.toBeNull()
  expect(media!.x).toBeGreaterThanOrEqual(mark!.x)
  expect(media!.y).toBeGreaterThanOrEqual(mark!.y)
  expect(media!.x + media!.width).toBeLessThanOrEqual(mark!.x + mark!.width)
  expect(media!.y + media!.height).toBeLessThanOrEqual(mark!.y + mark!.height)
}

async function waitForEntityMedia(page: Page) {
  await expect
    .poll(async () => {
      const image = page.locator('.hf-entity-mark img')
      if ((await image.count()) === 0) return true

      return image.evaluate((element) => {
        const imageElement = element as HTMLImageElement
        return imageElement.complete && imageElement.naturalWidth > 0
      })
    })
    .toBe(true)
}

test.describe('Equipos, selecciones y jugadores', () => {
  test('muestra el perfil real de un club y persiste favoritos', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/equipo/451', { waitUntil: 'domcontentloaded' })

    const profile = page.locator('.hf-team-page[data-team-id="451"]')
    await expect(profile).toBeVisible()
    await expect(profile.getByRole('heading', { level: 1 })).toContainText(
      'Boca Juniors'
    )
    await expect(
      page.locator('.hf-entity-nav + #competiciones')
    ).toBeVisible()
    expect(await page.locator('#plantel a[href^="/jugador/"]').count()).toBeGreaterThan(0)

    const competitionState = await page
      .locator('#competiciones')
      .locator('a, .hf-competition-empty')
      .count()
    expect(competitionState).toBeGreaterThan(0)

    for (const panel of [
      page.getByRole('heading', { name: 'Próximos partidos' }),
      page.getByRole('heading', { name: 'Últimos resultados' }),
      page.getByRole('heading', { name: 'Rendimiento' }),
      page.getByRole('heading', { name: 'Noticias relacionadas' }),
    ]) {
      await expect(panel).toBeVisible()
    }
    await expect(page.locator('.hf-team-performance')).toBeVisible()
    await expect(
      page.locator('.hf-entity-info-row').filter({ hasText: 'Entrenador' })
    ).toBeVisible()

    await page
      .getByRole('button', { name: 'Agregar Boca Juniors a favoritos' })
      .click()
    await expect(
      page.getByRole('button', { name: 'Quitar Boca Juniors de favoritos' })
    ).toHaveAttribute('aria-pressed', 'true')

    const storedFavorites = await page.evaluate(() =>
      JSON.parse(
        window.localStorage.getItem('hf:favorites:teams:v1') ?? '[]'
      )
    )
    expect(storedFavorites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '451', name: 'Boca Juniors' }),
      ])
    )

    await page.goto('/equipos', { waitUntil: 'domcontentloaded' })
    await expect(
      page.locator('.hf-favorite-team-item a[href="/equipo/451"]')
    ).toContainText('Boca Juniors')
    await page
      .getByRole('button', { name: 'Quitar Boca Juniors de favoritos' })
      .click()
    await expect(page.locator('.hf-favorite-teams-empty')).toBeVisible()

    await page.goto('/equipo/451', { waitUntil: 'domcontentloaded' })
    await validateResponsiveMatrix(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await expectEntityMediaFits(page)
    await waitForEntityMedia(page)
    await page.screenshot({
      path: testInfo.outputPath('team-mobile.png'),
      fullPage: true,
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.screenshot({
      path: testInfo.outputPath('team-desktop.png'),
      fullPage: true,
    })

    expect(consoleErrors).toEqual([])
  })

  test('trata a una selección como entidad deportiva completa', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/equipo/26', { waitUntil: 'domcontentloaded' })

    const profile = page.locator(
      '.hf-team-page[data-team-id="26"][data-national="true"]'
    )
    await expect(profile).toBeVisible()
    await expect(profile.getByRole('heading', { level: 1 })).toHaveText(
      'Argentina'
    )
    await expect(
      page.locator('.hf-entity-nav + #competiciones')
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Datos en Mundiales' })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Ranking y títulos' })
    ).toBeVisible()
    expect(await page.locator('#plantel .hf-squad-player').count()).toBeGreaterThan(0)
    expect(
      await page.locator('.hf-entity-news-list a[href^="/noticias/"]').count()
    ).toBeGreaterThan(0)

    await page.setViewportSize({ width: 320, height: 800 })
    await expectNoDocumentOverflow(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await expectNoDocumentOverflow(page)
    expect(consoleErrors).toEqual([])
  })

  test('abre un jugador real desde el plantel y conserva sus relaciones', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/equipo/451', { waitUntil: 'domcontentloaded' })

    const firstPlayer = page.locator('#plantel a[href^="/jugador/"]').first()
    await expect(firstPlayer).toBeVisible()
    const playerHref = await firstPlayer.getAttribute('href')
    expect(playerHref).toMatch(/^\/jugador\/\d+/)

    await page.goto(playerHref!, { waitUntil: 'domcontentloaded' })
    const profile = page.locator('.hf-player-page[data-player-id]')
    await expect(profile).toBeVisible()
    await expect(profile.getByRole('heading', { level: 1 })).not.toHaveText(
      'Jugador'
    )
    await expect(
      profile.locator('.hf-entity-title a[href="/equipo/451"]')
    ).toContainText('Boca Juniors')
    await expect(page.locator('#temporada .hf-player-stat-grid')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Partidos con registro' })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Ficha personal' })
    ).toBeVisible()
    await expect(
      page.locator('#ficha .hf-entity-info-row').filter({ hasText: 'Dorsal' })
    ).not.toContainText('No disponible')
    await expect(
      page.getByRole('heading', { name: 'Noticias relacionadas' })
    ).toBeVisible()

    await validateResponsiveMatrix(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await expectEntityMediaFits(page)
    await waitForEntityMedia(page)
    await page.screenshot({
      path: testInfo.outputPath('player-mobile.png'),
      fullPage: true,
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.screenshot({
      path: testInfo.outputPath('player-desktop.png'),
      fullPage: true,
    })
    expect(consoleErrors).toEqual([])
  })

  test('la búsqueda de equipos es operable y anuncia resultados reales', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/equipos', { waitUntil: 'load' })

    const trigger = page.getByRole('button', {
      name: 'Buscar equipo',
      exact: true,
    })
    await expect(trigger).toBeVisible()
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Buscar en Hay Fulbo' })
    await expect(dialog).toBeVisible()

    const search = dialog.getByRole('searchbox', { name: 'Buscar' })
    await expect(search).toBeFocused()
    await search.fill('Argentina')
    const argentina = dialog.locator('a[href="/equipo/26"]').first()
    await expect(argentina).toContainText('Argentina')

    await search.press('ArrowDown')
    await expect(argentina).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    expect(consoleErrors).toEqual([])
  })

  test('expone estados honestos para identificadores inválidos', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)

    await page.goto('/equipo/no-es-un-id', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('heading', { name: 'Equipo no encontrado' })
    ).toBeVisible()

    await page.goto('/jugador/no-es-un-id', {
      waitUntil: 'domcontentloaded',
    })
    await expect(
      page.getByRole('heading', { name: 'Jugador no disponible' })
    ).toBeVisible()
    expect(consoleErrors).toEqual([])
  })
})
