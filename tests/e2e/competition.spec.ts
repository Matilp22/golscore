import { expect, test } from '@playwright/test'

import { VISIBLE_TOURNAMENT_PAGE_CONFIGS } from '@/shared/config/tournament-pages'
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

async function expectCompetitionModulesBounded(page: import('@playwright/test').Page) {
  const result = await page.locator('.hf-competition-page-content').evaluate((container) => {
    const containerRect = container.getBoundingClientRect()
    const tolerance = 1
    const overflowingChildren = [...container.children]
      .map((child) => {
        const rect = child.getBoundingClientRect()
        return {
          id: child.id,
          className: child.className,
          left: rect.left,
          right: rect.right,
          width: rect.width,
        }
      })
      .filter(
        (child) =>
          child.left < containerRect.left - tolerance ||
          child.right > containerRect.right + tolerance ||
          child.width > containerRect.width + tolerance
      )

    const overflowingTables = [...container.querySelectorAll('.hf-standings-table-wrap')]
      .filter((table) => table.scrollWidth > table.clientWidth + tolerance)
      .map((table) => ({
        clientWidth: table.clientWidth,
        scrollWidth: table.scrollWidth,
      }))

    return {
      containerWidth: containerRect.width,
      overflowingChildren,
      overflowingTables,
    }
  })

  expect(result.containerWidth).toBeGreaterThan(0)
  expect(result.overflowingChildren).toEqual([])
  expect(result.overflowingTables).toEqual([])
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
    expect(await page.locator('#tabla .hf-standings-form').count()).toBeGreaterThan(0)
    expect(
      await page.locator('#equipos a[href^="/equipo/"]').count()
    ).toBeGreaterThan(10)
    expect(await page.locator('#sedes article').count()).toBeGreaterThan(0)
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
    const groupCount = await page.locator('#tabla .hf-group-card').count()

    if (groupCount > 0) {
      expect(groupCount).toBeGreaterThan(1)
      expect(await page.locator('#tabla .hf-standings-row').count()).toBeGreaterThan(10)

      const groupWithFixtures = page.locator('#tabla .hf-group-card').filter({
        has: page.getByRole('button', { name: /Partidos/i }),
      }).first()
      await groupWithFixtures.getByRole('button', { name: /Partidos/i }).click()
      await expect(
        groupWithFixtures.getByRole('button', { name: /Partidos/i })
      ).toHaveAttribute('aria-pressed', 'true')
      expect(await groupWithFixtures.locator('a[href^="/partido/"]').count()).toBeGreaterThan(0)
    } else {
      await expect(page.locator('#tabla')).toContainText(
        'No hay grupos disponibles para este torneo.'
      )
    }

    await page.setViewportSize({ width: 320, height: 800 })
    await expectNoDocumentOverflow(page)
    expect(consoleErrors).toEqual([])
  })

  test('mantiene acotadas y ordenadas todas las familias de competencia', async ({ page }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    const representatives = [
      { slug: 'argentina-liga-profesional', family: 'argentina-zones' },
      { slug: 'inglaterra-premier-league', family: 'league' },
      { slug: 'internacional-libertadores', family: 'conmebol-groups' },
      { slug: 'internacional-champions', family: 'uefa-league-phase' },
      { slug: 'argentina-copa-argentina', family: 'knockout' },
      { slug: 'selecciones-copa-america', family: 'groups' },
    ]

    await page.setViewportSize({ width: 390, height: 844 })

    for (const representative of representatives) {
      await page.goto(`/liga/${representative.slug}`, { waitUntil: 'domcontentloaded' })

      const competition = page.locator('.hf-competition-page')
      await expect(competition).toHaveAttribute('data-competition-family', representative.family)
      await expectCompetitionModulesBounded(page)
      await expectNoDocumentOverflow(page)

      const visibleSectionIds = await page
        .locator('.hf-competition-page-content > [id]')
        .evaluateAll((elements) => elements.map((element) => element.id))
      const expectedOrder = ['tabla', 'partidos', 'llaves'].filter((id) =>
        visibleSectionIds.includes(id)
      )
      const actualOrder = visibleSectionIds.filter((id) => expectedOrder.includes(id))

      expect(actualOrder).toEqual(expectedOrder)
    }

    expect(consoleErrors).toEqual([])
  })

  const configuredCompetitionChunks = [
    VISIBLE_TOURNAMENT_PAGE_CONFIGS.slice(0, 25),
    VISIBLE_TOURNAMENT_PAGE_CONFIGS.slice(25),
  ]

  configuredCompetitionChunks.forEach((tournaments, index) => {
    test(`abre todas las competiciones configuradas sin recortes, tramo ${index + 1}`, async ({ page }) => {
      test.setTimeout(360_000)
      const consoleErrors = await prepareReadOnlyPage(page)
      await page.setViewportSize({ width: 390, height: 844 })

      for (const tournament of tournaments) {
        await page.goto(`/liga/${tournament.key}`, { waitUntil: 'domcontentloaded' })
        await expect(page.locator('h1').first()).toBeVisible()
        await expectNoDocumentOverflow(page)

        if (tournament.key === 'selecciones-mundial') {
          await expect(page.locator('.hf-world26-page')).toBeVisible()
          continue
        }

        await expect(page.locator('.hf-competition-page')).toHaveAttribute(
          'data-competition',
          tournament.key
        )
        await expectCompetitionModulesBounded(page)
      }

      expect(consoleErrors).toEqual([])
    })
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
