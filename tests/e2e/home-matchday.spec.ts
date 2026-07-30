import { expect, test } from '@playwright/test'

import { prepareReadOnlyPage } from './read-only-page'

const FIXTURE_DATE = '2026-07-29'

test.describe('Home Matchday', () => {
  test('no desborda en la matriz responsive completa', async ({ page }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto(`/?date=${FIXTURE_DATE}`, {
      waitUntil: 'domcontentloaded',
    })
    await expect(page.locator('.hf-matchday-page')).toBeVisible()

    for (const viewport of [
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
    ]) {
      await page.setViewportSize(viewport)
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))

      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
    }

    expect(consoleErrors).toEqual([])
  })

  test('muestra cada partido una vez y conserva sus enlaces', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/?date=${FIXTURE_DATE}`, {
      waitUntil: 'domcontentloaded',
    })

    const rows = page.locator('.hf-matchday-match')
    await expect(rows.first()).toBeVisible()

    const matchHrefs = await page
      .locator('.hf-matchday-score-link')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).pathname)
      )

    expect(matchHrefs.length).toBeGreaterThan(0)
    expect(new Set(matchHrefs).size).toBe(matchHrefs.length)
    expect(matchHrefs.every((href) => href.startsWith('/partido/'))).toBe(true)
    await expect(rows.first().locator('a[href^="/equipo/"]').first()).toBeVisible()
    await expect(
      page.locator('.hf-matchday-match > header a[href^="/liga/"]').first()
    ).toBeVisible()
    await expect(
      page.locator('.hf-matchday-news-grid a[href^="/noticias/"]').first()
    ).toBeVisible()
    await expect(page.locator('.hf-matchday-quick-grid a')).toHaveCount(4)

    const sectionTotal = await page
      .locator('.hf-matchday-section-count')
      .evaluateAll((counts) =>
        counts.reduce(
          (total, count) =>
            total + Number(count.firstChild?.textContent?.trim() ?? 0),
          0
        )
      )
    expect(sectionTotal).toBe(await rows.count())

    await page.screenshot({
      path: testInfo.outputPath('home-matchday-mobile.png'),
      fullPage: true,
    })
    expect(consoleErrors).toEqual([])
  })

  test('permite navegar por fecha y por secciones', async ({ page }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/?date=${FIXTURE_DATE}`, {
      waitUntil: 'domcontentloaded',
    })

    const activeDay = page.locator(
      `.hf-matchday-day-switcher a[href="/?date=${FIXTURE_DATE}"]`
    )
    await expect(activeDay).toHaveAttribute('aria-current', 'date')

    const todayLink = page
      .locator('.hf-matchday-day-switcher a')
      .filter({ hasText: 'Hoy' })
    const todayHref = await todayLink.getAttribute('href')
    expect(todayHref).toBeTruthy()
    await todayLink.click()
    await expect(page).toHaveURL(new RegExp(todayHref!.replace('?', '\\?')))

    const todayDate = new URL(todayHref!, 'http://127.0.0.1').searchParams.get(
      'date'
    )
    await expect(page.locator('#home-date-picker')).toHaveValue(todayDate!)

    await page.locator('#home-date-picker').fill(FIXTURE_DATE)
    await page.getByRole('button', { name: 'Ver jornada' }).click()
    await expect(page).toHaveURL(new RegExp(`date=${FIXTURE_DATE}`))

    await page.locator('.hf-matchday-jump-nav a[href="#resultados"]').click()
    await expect(page.locator('#resultados')).toBeInViewport()
    await expect(page.locator('#home-date-picker')).toHaveValue(FIXTURE_DATE)

    await page.screenshot({
      path: testInfo.outputPath('home-matchday-desktop.png'),
      fullPage: true,
    })
    expect(consoleErrors).toEqual([])
  })

  test('muestra favoritos persistidos y permite quitarlos', async ({ page }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'hf:favorites:teams:v1',
        JSON.stringify([
          {
            id: '451',
            name: 'Boca Juniors',
            href: '/equipo/451',
            createdAt: '2026-07-29T12:00:00.000Z',
          },
        ])
      )
    })

    await page.goto(`/?date=${FIXTURE_DATE}`, {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.locator('.hf-matchday-favorite a[href="/equipo/451"]')
    ).toContainText('Boca Juniors')
    await page
      .getByRole('button', { name: 'Quitar Boca Juniors de favoritos' })
      .click()
    await expect(page.locator('.hf-matchday-favorites-empty')).toBeVisible()
    expect(
      await page.evaluate(() =>
        JSON.parse(
          window.localStorage.getItem('hf:favorites:teams:v1') ?? 'null'
        )
      )
    ).toEqual([])
    expect(consoleErrors).toEqual([])
  })
})
