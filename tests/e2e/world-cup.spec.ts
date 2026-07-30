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

test.describe('Mundial 2026', () => {
  test('conecta partidos, grupos, llaves, selecciones y noticias reales', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/liga/selecciones-mundial', {
      waitUntil: 'domcontentloaded',
    })

    const experience = page.locator('.hf-world26-page')
    await expect(experience).toBeVisible()
    await expect(
      experience.getByRole('heading', { level: 1 })
    ).toContainText(/Mundial|Copa del Mundo/i)
    await expect(
      page.getByRole('navigation', { name: 'Secciones del Mundial 2026' })
    ).toBeVisible()

    for (const heading of [
      'Partidos',
      'Grupos y clasificación',
      'Fase eliminatoria',
      'Estadísticas',
      'Selecciones',
      'Noticias',
      'Sedes',
      'Historia',
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    }

    const matchLinks = page.locator(
      '#partidos .hf-world26-score[href^="/partido/"]'
    )
    expect(await matchLinks.count()).toBeGreaterThan(0)
    const matchHrefs = await matchLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute('href'))
    )
    expect(new Set(matchHrefs).size).toBe(matchHrefs.length)

    expect(
      await page.locator('#noticias a[href^="/noticias/"]').count()
    ).toBeGreaterThan(0)
    const groupState = await page
      .locator('#grupos')
      .locator('.hf-world26-data, .hf-world26-empty')
      .count()
    const bracketState = await page
      .locator('#llaves')
      .locator('.hf-world26-data, .hf-world26-empty')
      .count()
    const statsState = await page
      .locator('#estadisticas')
      .locator('.hf-world26-data, .hf-world26-empty')
      .count()
    expect(groupState).toBeGreaterThan(0)
    expect(bracketState).toBeGreaterThan(0)
    expect(statsState).toBeGreaterThan(0)

    const bracketTabs = page.getByRole('tablist', {
      name: 'Llaves Copa del Mundo 2026',
    })
    await expect(bracketTabs).toBeVisible()
    const simulatorTab = bracketTabs.getByRole('tab', { name: 'Simulador' })
    await simulatorTab.click()
    await expect(simulatorTab).toHaveAttribute('aria-selected', 'true')
    await expect(
      page.getByRole('button', { name: 'Reiniciar simulación' })
    ).toBeVisible()
    await bracketTabs.getByRole('tab', { name: 'Llaves' }).click()

    const firstReminder = page
      .locator('#partidos .hf-match-reminder-button')
      .first()
    if (await firstReminder.isVisible().catch(() => false)) {
      await firstReminder.click()
      await expect(firstReminder).toHaveAttribute('aria-pressed', 'true')
      const storedReminders = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem('hf:match-reminders:v1') ?? '[]')
      )
      expect(storedReminders.length).toBeGreaterThan(0)
    }

    await page
      .getByRole('navigation', { name: 'Secciones del Mundial 2026' })
      .getByRole('link', { name: 'Grupos' })
      .click()
    await expect(page).toHaveURL(/#grupos$/)

    for (const viewport of RESPONSIVE_VIEWPORTS) {
      await page.setViewportSize(viewport)
      await expectNoDocumentOverflow(page)
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.hf-world26-hero').screenshot({
      path: testInfo.outputPath('world-cup-mobile.png'),
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.locator('.hf-world26-hero').screenshot({
      path: testInfo.outputPath('world-cup-desktop.png'),
    })

    await expect
      .poll(() =>
        page.locator('.hf-world26-trophy img').evaluate((element) => {
          const image = element as HTMLImageElement
          return image.complete && image.naturalWidth > 0
        })
      )
      .toBe(true)
    expect(consoleErrors).toEqual([])
  })

  test('mantiene metadata específica y evita el sistema visual anterior', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/liga/selecciones-mundial', {
      waitUntil: 'domcontentloaded',
    })

    await expect(page).toHaveTitle(/Mundial 2026/)
    await expect(page.locator('.hf-world-shell')).toHaveCount(0)
    await expect(page.locator('.hf-world-image-carousel')).toHaveCount(0)
    await expect(page.locator('.hf-world26-page')).toBeVisible()
    expect(consoleErrors).toEqual([])
  })
})
