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

async function expectBasicAccessibility(page: Page) {
  await expect(page.locator('.hf-loading-page')).toHaveCount(0)

  const audit = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')]
      .map((element) => element.id)
      .filter(Boolean)
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
    const unnamedInteractive = [
      ...document.querySelectorAll<HTMLElement>('a[href], button'),
    ]
      .filter((element) => {
        const style = window.getComputedStyle(element)
        return style.display !== 'none' && style.visibility !== 'hidden'
      })
      .filter((element) => {
        const text = element.textContent?.trim()
        return !text && !element.getAttribute('aria-label') && !element.title
      })
      .map((element) => element.outerHTML.slice(0, 180))
    const imagesWithoutAlt = [
      ...document.querySelectorAll<HTMLImageElement>('img:not([alt])'),
    ].map((image) => image.outerHTML.slice(0, 180))

    return {
      duplicateIds: [...new Set(duplicateIds)],
      h1Count: document.querySelectorAll('h1').length,
      imagesWithoutAlt,
      mainCount: document.querySelectorAll('main').length,
      unnamedInteractive,
    }
  })

  expect(audit.mainCount).toBe(1)
  expect(audit.h1Count).toBeGreaterThanOrEqual(1)
  expect(audit.duplicateIds).toEqual([])
  expect(audit.imagesWithoutAlt).toEqual([])
  expect(audit.unnamedInteractive).toEqual([])
}

test.describe('Plataforma, estados y SEO', () => {
  test('presenta una 404 propia, accesible y responsive', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    const response = await page.goto('/ruta-qa-que-no-existe', {
      waitUntil: 'domcontentloaded',
    })

    expect(response?.status()).toBe(404)
    const state = page.locator('.hf-system-state-page')
    await expect(
      state.getByRole('heading', {
        name: 'Esta página no está en la cancha.',
        level: 1,
      })
    ).toBeVisible()
    await expect(
      state.getByRole('link', { name: 'Ir a los partidos' })
    ).toHaveAttribute('href', '/')
    await expect(
      state.getByRole('link', { name: 'Ver competiciones' })
    ).toHaveAttribute('href', '/competiciones')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/
    )
    await expectBasicAccessibility(page)
    await validateWidths(page)

    await page.setViewportSize({ width: 390, height: 844 })
    await state.screenshot({ path: testInfo.outputPath('not-found-mobile.png') })
    await page.setViewportSize({ width: 1440, height: 900 })
    await state.screenshot({ path: testInfo.outputPath('not-found-desktop.png') })

    expect(
      consoleErrors.filter(
        (error) =>
          !(
            error.includes('status of 404') &&
            error.includes('/ruta-qa-que-no-existe')
          )
      )
    ).toEqual([])
  })

  test('mantiene robots y sitemap sin rutas privadas', async ({ request }) => {
    const robotsResponse = await request.get('/robots.txt')
    expect(robotsResponse.ok()).toBe(true)
    const robots = await robotsResponse.text()
    expect(robots).toContain('Disallow: /admin')
    expect(robots).toContain('Sitemap:')

    const sitemapResponse = await request.get('/sitemap.xml')
    expect(sitemapResponse.ok()).toBe(true)
    const sitemap = await sitemapResponse.text()
    for (const route of [
      '/competiciones',
      '/equipos',
      '/estadisticas',
      '/tablas',
      '/mi-torneito',
    ]) {
      expect(sitemap).toContain(route)
    }
    expect(sitemap).not.toContain('/admin')
    expect(sitemap).not.toContain('/perfil')
  })

  test('conserva redirecciones públicas heredadas', async ({ page }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    const aliases = [
      { from: '/contact', to: '/contacto' },
      { from: '/privacy-policy', to: '/privacidad' },
      { from: '/terms', to: '/terminos' },
    ]

    for (const alias of aliases) {
      await page.goto(alias.from, { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(new RegExp(`${alias.to}$`))
      await expectBasicAccessibility(page)
    }

    expect(consoleErrors).toEqual([])
  })

  test('conserva metadatos, landmarks y nombres accesibles', async ({ page }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    const publicRoutes = [
      { path: '/', canonicalPath: '/' },
      { path: '/noticias', canonicalPath: '/noticias' },
      { path: '/mi-torneito', canonicalPath: '/mi-torneito' },
    ]

    for (const route of publicRoutes) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        /.+/
      )
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        'content',
        /.+/
      )
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        /summary/
      )
      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute('href')
      expect(new URL(canonical!).pathname).toBe(route.canonicalPath)
      await expectBasicAccessibility(page)
      await expectNoOverflow(page)
    }

    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/
    )
    await expectBasicAccessibility(page)
    expect(consoleErrors).toEqual([])
  })

  test('respeta reducción de movimiento y reserva el espacio publicitario', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.route('**/pagead2.googlesyndication.com/**', async (route) => {
      await route.fulfill({ status: 204, body: '' })
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    expect(
      await page.evaluate(() => window.getComputedStyle(document.documentElement).scrollBehavior)
    ).toBe('auto')
    await expect(
      page.locator('meta[name="google-adsense-account"]')
    ).toHaveAttribute('content', /^ca-pub-/)
    await expect(page.locator('script#google-adsense')).toHaveAttribute(
      'src',
      /googlesyndication/
    )

    const adSlot = page.locator('.hf-ad-slot').first()
    if (await adSlot.count()) {
      await expect(adSlot).toHaveAttribute('aria-label', 'Publicidad')
      await expect(adSlot.locator('.hf-ad-slot-label')).toHaveText('Publicidad')
      expect(
        await adSlot.evaluate((element) =>
          Number.parseFloat(window.getComputedStyle(element).minHeight)
        )
      ).toBeGreaterThanOrEqual(120)
    }

    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.hf-ad-slot')).toHaveCount(0)
    expect(consoleErrors).toEqual([])
  })

  test('explica un corte de red de búsqueda sin mostrar errores técnicos', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.route('**/api/search-catalog**', async (route) => {
      await route.abort('internetdisconnected')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page
      .getByRole('button', {
        name: 'Buscar equipos, partidos, jugadores y noticias',
      })
      .click()

    const search = page.getByRole('dialog', { name: 'Buscar en Hay Fulbo' })
    await search.getByRole('searchbox').fill('river')
    await expect(search.getByRole('alert')).toContainText(
      'No pudimos completar la búsqueda.'
    )
    await expect(search).not.toContainText('Failed to fetch')
    await expectNoOverflow(page)
    expect(
      consoleErrors.filter(
        (error) =>
          !(
            error.includes('ERR_INTERNET_DISCONNECTED') &&
            error.includes('/api/search-catalog?q=river')
          )
      )
    ).toEqual([])
  })
})
