import { expect, test } from '@playwright/test'

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

async function expectNoDocumentOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
}

test.describe('Competiciones y tablas', () => {
  test('filtra el catálogo real y conserva los enlaces', async ({ page }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/competiciones', { waitUntil: 'domcontentloaded' })

    const cards = page.locator('.hf-competition-directory-card')
    expect(await cards.count()).toBeGreaterThan(20)
    await expect(page.getByRole('heading', { name: 'Todo el fútbol, bien ordenado' })).toBeVisible()

    const search = page.getByRole('searchbox', { name: 'Filtrar competiciones' })
    await search.fill('Libertadores')
    await expect(page.locator('.hf-competition-directory-result')).toContainText('1 resultado')
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toHaveAttribute('href', '/liga/internacional-libertadores')

    await search.fill('competición que no existe')
    await expect(page.getByRole('heading', { name: 'Sin coincidencias' })).toBeVisible()
    await page.getByRole('button', { name: 'Ver todas' }).click()
    expect(await cards.count()).toBeGreaterThan(20)

    for (const viewport of RESPONSIVE_VIEWPORTS) {
      await page.setViewportSize(viewport)
      await expectNoDocumentOverflow(page)
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({
      path: testInfo.outputPath('competition-directory-mobile.png'),
      fullPage: true,
    })
    expect(consoleErrors).toEqual([])
  })

  test('abre una liga con partidos, tabla y estadísticas reales', async ({ page }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/liga/argentina-liga-profesional', {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.locator('[data-competition="argentina-liga-profesional"]')
    ).toBeVisible()
    await expect(page.locator('.hf-competition-title h1')).toContainText('Liga Profesional')
    expect(await page.locator('#partidos a[href^="/partido/"]').count()).toBeGreaterThan(0)
    expect(await page.locator('#tabla .hf-standings-row').count()).toBeGreaterThan(10)
    await expect(page.locator('#estadisticas')).toBeVisible()

    for (const viewport of RESPONSIVE_VIEWPORTS) {
      await page.setViewportSize(viewport)
      await expectNoDocumentOverflow(page)
    }

    await page.setViewportSize({ width: 390, height: 844 })
    const firstMatchRow = page.locator('.hf-current-round-row').first()
    const firstMatchBounds = await firstMatchRow.boundingBox()
    const scoreBounds = await firstMatchRow.locator('.hf-current-round-score').boundingBox()
    const awayBounds = await firstMatchRow.locator('.hf-current-round-team').last().boundingBox()
    expect(firstMatchBounds).not.toBeNull()
    expect(scoreBounds).not.toBeNull()
    expect(awayBounds).not.toBeNull()
    expect(scoreBounds!.x).toBeGreaterThanOrEqual(firstMatchBounds!.x)
    expect(scoreBounds!.x + scoreBounds!.width).toBeLessThanOrEqual(
      firstMatchBounds!.x + firstMatchBounds!.width
    )
    expect(awayBounds!.x).toBeGreaterThanOrEqual(firstMatchBounds!.x)
    expect(awayBounds!.x + awayBounds!.width).toBeLessThanOrEqual(
      firstMatchBounds!.x + firstMatchBounds!.width
    )
    await page.screenshot({
      path: testInfo.outputPath('league-mobile.png'),
      fullPage: true,
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.screenshot({
      path: testInfo.outputPath('league-desktop.png'),
      fullPage: true,
    })
    expect(consoleErrors).toEqual([])
  })

  test('respeta grupos y llaves reales de una copa continental', async ({ page }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/liga/internacional-libertadores', {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.locator('[data-competition="internacional-libertadores"]')
    ).toBeVisible()
    await expect(page.locator('#llaves')).toBeVisible()
    await expect(page.locator('#tabla')).toBeVisible()
    expect(await page.locator('#tabla .hf-group-card').count()).toBeGreaterThan(1)
    expect(await page.locator('#tabla .hf-standings-row').count()).toBeGreaterThan(10)

    const groupWithFixtures = page.locator('#tabla .hf-group-card').filter({
      has: page.getByRole('button', { name: /Partidos/i }),
    }).first()
    await groupWithFixtures.getByRole('button', { name: /Partidos/i }).click()
    await expect(
      groupWithFixtures.getByRole('button', { name: /Partidos/i })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(await groupWithFixtures.locator('a[href^="/partido/"]').count()).toBeGreaterThan(0)

    await page.setViewportSize({ width: 320, height: 800 })
    await expectNoDocumentOverflow(page)
    expect(consoleErrors).toEqual([])
  })

  test('el centro de tablas enlaza a la sección correcta', async ({ page }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/tablas', { waitUntil: 'domcontentloaded' })

    const search = page.getByRole('searchbox', { name: 'Filtrar tablas' })
    await search.fill('Liga Profesional')
    const result = page.locator('.hf-competition-directory-card')
    await expect(result).toHaveCount(1)
    await expect(result).toHaveAttribute('href', '/liga/argentina-liga-profesional#tabla')
    await result.click()
    await expect(page).toHaveURL(/\/liga\/argentina-liga-profesional#tabla$/)
    expect(consoleErrors).toEqual([])
  })
})
