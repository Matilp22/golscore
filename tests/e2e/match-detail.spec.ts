import { expect, test } from '@playwright/test'

import { prepareReadOnlyPage } from './read-only-page'

const COMPLETE_FIXTURE = '1547783'
const UPCOMING_FIXTURE = '1493020'
const POSTPONED_FIXTURE = '1492312'

test.describe('Detalle de partido', () => {
  test('conserva datos, secciones e interacciones en todos los anchos', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto(`/partido/${COMPLETE_FIXTURE}`, {
      waitUntil: 'domcontentloaded',
    })

    await expect(page.locator('.hf-match-detail-page')).toBeVisible()
    await expect(page.locator('.hf-match-detail-title')).toContainText(' vs ')
    await expect(
      page.locator('.hf-match-detail-competition a[href^="/liga/"]')
    ).toBeVisible()
    await expect(
      page.locator('.hf-match-detail-team-link[href^="/equipo/"]')
    ).toHaveCount(2)
    await expect(page.locator('.hf-match-detail-facts > div')).toHaveCount(3)
    await expect(page.locator('.hf-match-detail-nav a')).toHaveCount(6)
    expect(
      await page.locator('[data-match-detail="timeline-event"]').count()
    ).toBeGreaterThan(0)
    expect(
      await page.locator('[data-match-detail="statistics-row"]').count()
    ).toBeGreaterThan(0)
    await expect(page.locator('[data-match-detail="lineup-tabs"]')).toBeVisible()
    await expect(
      page.locator('[data-match-detail="history-card"]')
    ).toBeVisible()
    await expect(
      page.locator('[data-match-summary-provider]')
    ).toBeVisible()

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

    await page.setViewportSize({ width: 390, height: 844 })
    const substitutes = page.getByRole('button', { name: /Suplentes/ })
    await substitutes.click()
    await expect(substitutes).toHaveAttribute('aria-pressed', 'true')
    await page.screenshot({
      path: testInfo.outputPath('match-detail-mobile.png'),
      fullPage: true,
    })

    const barWidths = await page
      .locator('[data-match-detail="statistics-row"]')
      .evaluateAll((rows) =>
        rows.flatMap((row) =>
          [...row.querySelectorAll<HTMLElement>('[style*="width"]')].map(
            (bar) => Number.parseFloat(bar.style.width)
          )
        )
      )
    expect(
      barWidths.every((width) => Number.isFinite(width) && width >= 0 && width <= 100)
    ).toBe(true)
    expect(consoleErrors).toEqual([])
  })

  test('navega por anclas y abre/cierra compartir con teclado', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/partido/${COMPLETE_FIXTURE}`, {
      waitUntil: 'domcontentloaded',
    })

    await page.locator('.hf-match-detail-nav a[href*="match-stats-card"]').click()
    await expect(page.locator('[data-match-detail="stats-card"]')).toBeInViewport()

    const shareTrigger = page
      .getByRole('button', { name: 'Compartir' })
      .first()
    await shareTrigger.click()
    await expect(
      page.getByRole('dialog', { name: 'Opciones para compartir' })
    ).toBeVisible()
    const closeShare = page.getByRole('button', { name: 'Cerrar', exact: true })
    await expect(closeShare).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('button', { name: 'Abrir PNG' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('dialog', { name: 'Opciones para compartir' })
    ).toBeHidden()
    await expect(shareTrigger).toBeFocused()

    await page.screenshot({
      path: testInfo.outputPath('match-detail-desktop.png'),
      fullPage: true,
    })
    expect(consoleErrors).toEqual([])
  })

  test('activa y desactiva un recordatorio real', async ({ page }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto(`/partido/${UPCOMING_FIXTURE}`, {
      waitUntil: 'domcontentloaded',
    })

    const reminder = page.getByRole('button', {
      name: /Recordarme/,
    })
    await expect(reminder).toHaveAttribute('aria-pressed', 'false')
    await reminder.click()
    const activeReminder = page.getByRole('button', {
      name: /Quitar recordatorio/,
    })
    await expect(activeReminder).toHaveAttribute('aria-pressed', 'true')
    await activeReminder.click()
    await expect(
      page.getByRole('button', { name: /Recordarme/ })
    ).toHaveAttribute('aria-pressed', 'false')
    expect(consoleErrors).toEqual([])
  })

  test('muestra estados honestos cuando faltan formaciones', async ({ page }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto(`/partido/${POSTPONED_FIXTURE}`, {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.locator('.hf-match-detail-formations .hf-match-detail-empty')
    ).toBeVisible()
    await expect(
      page.locator('.hf-match-detail-formations')
    ).toContainText(/formación/i)
    expect(consoleErrors).toEqual([])
  })
})
