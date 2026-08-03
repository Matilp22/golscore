import { expect, test } from '@playwright/test'

import { prepareReadOnlyPage } from './read-only-page'

const FIXTURE_DATE = '2026-07-29'

test.describe('Home Matchday', () => {
  test('no desborda en la matriz responsive completa', async ({ page }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto(`/?date=${FIXTURE_DATE}`, {
      waitUntil: 'domcontentloaded',
    })
    await expect(page.locator('.hf-orbit-home')).toBeVisible()

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

    const rows = page.locator('.hf-stream-match')
    await expect(rows.first()).toBeVisible()

    const matchHrefs = await page
      .locator('.hf-stream-match-outcome')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).pathname)
      )

    expect(matchHrefs.length).toBeGreaterThan(0)
    expect(new Set(matchHrefs).size).toBe(matchHrefs.length)
    expect(matchHrefs.every((href) => href.startsWith('/partido/'))).toBe(true)
    await expect(rows.first().locator('a[href^="/equipo/"]').first()).toBeVisible()
    await expect(
      page.locator('.hf-stream-match-league a[href^="/liga/"]').first()
    ).toBeVisible()
    await expect(
      page.locator('.hf-stream-news-list a[href^="/noticias/"]').first()
    ).toBeVisible()
    await expect(page.locator('.hf-stream-shortcuts a')).toHaveCount(4)

    const visibleTotal = Number(
      await page.locator('.hf-stream-feed-heading > strong').textContent()
    )
    expect(visibleTotal).toBe(await rows.count())

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
      `.hf-stream-day-jump a[href="/?date=${FIXTURE_DATE}"]`
    )
    await expect(activeDay).toHaveAttribute('aria-current', 'date')

    const adjacentDay = page.locator('.hf-stream-day-jump a').last()
    const adjacentHref = await adjacentDay.getAttribute('href')
    expect(adjacentHref).toBeTruthy()
    await adjacentDay.click()
    await expect(page).toHaveURL(new RegExp(adjacentHref!.replace('?', '\\?')))

    const adjacentDate = new URL(adjacentHref!, 'http://127.0.0.1').searchParams.get(
      'date'
    )
    await expect(page.locator('#stream-date-picker')).toHaveValue(adjacentDate!)

    await page.locator('#stream-date-picker').fill(FIXTURE_DATE)
    await page.locator('.hf-stream-calendar').getByRole('button', { name: 'Ver' }).click()
    await expect(page).toHaveURL(new RegExp(`date=${FIXTURE_DATE}`))

    await page.getByRole('button', { name: /^Finales/ }).click()
    await expect(page.getByRole('button', { name: /^Finales/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect(page.locator('#partidos')).toBeInViewport()
    await expect(page.locator('#stream-date-picker')).toHaveValue(FIXTURE_DATE)

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
      page.locator('.hf-stream-favorite-team a[href="/equipo/451"]')
    ).toContainText('Boca Juniors')
    await page
      .getByRole('button', { name: 'Quitar Boca Juniors de favoritos' })
      .click()
    await expect(page.locator('.hf-stream-favorite-empty')).toBeVisible()
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
