import { expect, test, type Page } from '@playwright/test'

function collectConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(message.text())
    }
  })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (
      response.status() >= 400 &&
      !response.url().includes('/_vercel/insights/script.js')
    ) {
      errors.push(`${response.status()} ${response.url()}`)
    }
  })
  return errors
}

test('liga profesional respeta jerarquia y tablas compactas', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/liga/argentina-liga-profesional', { waitUntil: 'domcontentloaded' })

  const navItems = page.locator('.hf-league-section-nav > a')
  await expect(navItems.nth(0)).toContainText('Clasificación')
  await expect(navItems.nth(1)).toContainText('Partidos')
  await expect(navItems.nth(2)).toContainText('Llaves')

  const sectionOrder = await page.evaluate(() => {
    const top = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().top ?? null
    return { table: top('#tabla'), matches: top('#partidos'), bracket: top('#llaves') }
  })
  expect(sectionOrder.table).not.toBeNull()
  if (sectionOrder.matches !== null) expect(sectionOrder.table as number).toBeLessThan(sectionOrder.matches)
  if (sectionOrder.matches !== null && sectionOrder.bracket !== null) {
    expect(sectionOrder.matches).toBeLessThan(sectionOrder.bracket)
  }

  const groupTabs = page.locator('.hf-competition-group-tabs [role="tab"]')
  if (await groupTabs.count()) {
    await expect(groupTabs).toHaveCount(2)
    await groupTabs.nth(1).click()
    await expect(groupTabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  }

  const tableOverflow = await page.locator('.hf-standings-table-wrap').evaluateAll((nodes) =>
    nodes.map((node) => ({ client: node.clientWidth, scroll: node.scrollWidth }))
  )
  expect(tableOverflow.every((item) => item.scroll <= item.client + 1)).toBe(true)

  const bodyOverflow = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  expect(bodyOverflow.scroll).toBeLessThanOrEqual(bodyOverflow.client + 1)
  expect(errors).toEqual([])
})

test('partido y equipo conservan la nueva jerarquia visual', async ({ page }) => {
  const errors = collectConsoleErrors(page)
  await page.goto('/liga/argentina-liga-profesional', { waitUntil: 'domcontentloaded' })

  const matchHref = await page.locator('a[href^="/partido/"]').first().getAttribute('href')
  expect(matchHref).toBeTruthy()
  await page.goto(matchHref as string, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.hf-match-detail-title')).toBeVisible()
  await expect(page.locator('.hf-match-detail-scoreboard')).toBeVisible()
  await expect(page.locator('.hf-match-detail-facts > *')).toHaveCount(3)

  const statRows = page.locator('[data-match-detail="statistics-row"]')
  if (await statRows.count()) {
    await expect(statRows.first().locator('.hf-match-detail-stat-label')).toBeVisible()
    await expect(statRows.first().locator('.hf-match-detail-stat-meter')).toBeVisible()
  }

  await page.goto('/liga/argentina-liga-profesional', { waitUntil: 'domcontentloaded' })
  const teamHref = await page.locator('#tabla a[href^="/equipo/"]').first().getAttribute('href')
  expect(teamHref).toBeTruthy()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(teamHref as string, { waitUntil: 'domcontentloaded' })
  const teamOrder = await page.evaluate(() => ({
    hero: document.querySelector('.hf-entity-hero')?.getBoundingClientRect().top ?? null,
    competitions: document.querySelector('.hf-team-competitions')?.getBoundingClientRect().top ?? null,
  }))
  expect(teamOrder.hero).not.toBeNull()
  if (teamOrder.competitions !== null) expect(teamOrder.hero as number).toBeLessThan(teamOrder.competitions)
  expect(errors).toEqual([])
})

test('flujos editoriales, prode y mi torneito muestran la estructura actual', async ({ page }) => {
  await page.goto('/noticias', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.hf-editorial-page-hero dl')).toHaveCount(0)
  await expect(page.locator('.hf-editorial-filters')).toContainText('Liga Profesional')

  await page.goto('/mercado-de-pases', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.hf-editorial-page-hero dl')).toHaveCount(0)

  await page.goto('/prode', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.hf-prode-matchday-rule')).toHaveCount(0)
  await expect(page.locator('.hf-prode-context-nav')).not.toContainText('Mundial 2026')

  await page.goto('/mi-torneito', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('searchbox', { name: 'Buscar torneo por nombre o ciudad' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Cómo funciona' })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.hf-mobile-bottom-nav')).toContainText('Competiciones')
  await expect(page.locator('.hf-mobile-bottom-nav')).not.toContainText('Partidos')
})
