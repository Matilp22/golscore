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

test.describe('Noticias y mercado editorial', () => {
  test('filtra noticias reales y abre un artículo completo', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/noticias', { waitUntil: 'domcontentloaded' })

    const pageRoot = page.locator('.hf-editorial-page')
    await expect(pageRoot).toBeVisible()
    await expect(
      pageRoot.getByRole('heading', { name: 'Noticias', level: 1 })
    ).toBeVisible()
    const articleLinks = page.locator(
      '.hf-editorial-card[href^="/noticias/"]'
    )
    expect(await articleLinks.count()).toBeGreaterThan(3)

    const categoryFilter = page
      .getByRole('navigation', { name: 'Filtrar noticias por categoría' })
      .getByRole('link', { name: /Mundial 2026/ })
    await categoryFilter.click()
    await expect(page).toHaveURL(/categoria=mundial-2026/)
    await expect(categoryFilter).toHaveAttribute('aria-current', 'page')
    expect(await articleLinks.count()).toBeGreaterThan(0)

    const firstArticle = articleLinks.first()
    const articleHref = await firstArticle.getAttribute('href')
    const articleTitle = (await firstArticle.locator(
      '.hf-editorial-card-copy > strong'
    ).textContent())?.trim()
    expect(articleHref).toMatch(/^\/noticias\/.+/)
    expect(articleTitle).toBeTruthy()

    await page.setViewportSize({ width: 390, height: 844 })
    await firstArticle.screenshot({
      path: testInfo.outputPath('news-card-mobile.png'),
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await firstArticle.screenshot({
      path: testInfo.outputPath('news-card-desktop.png'),
    })
    await firstArticle.click()
    await expect(page).toHaveURL(articleHref!)
    const detail = page.locator('.hf-editorial-detail')
    await expect(detail).toBeVisible()
    await expect(
      detail.getByRole('heading', { level: 1 })
    ).toHaveText(articleTitle!)
    await expect(page.locator('.hf-editorial-article-body p').first()).toBeVisible()
    await expect(page.locator('.hf-editorial-article-byline')).toContainText(
      'Redacción Hay Fulbo'
    )
    await expect(
      page.locator('script[type="application/ld+json"]')
    ).toHaveCount(1)

    const shareButton = page.getByRole('button', {
      name: `Compartir ${articleTitle}`,
    })
    await shareButton.click()
    const shareDialog = page.getByRole('dialog', {
      name: 'Opciones para compartir',
    })
    await expect(shareDialog).toBeVisible()
    await expect(shareDialog.getByRole('button', { name: 'WhatsApp' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(shareDialog).toBeHidden()
    await expect(shareButton).toBeFocused()

    expect(
      await page.locator('.hf-editorial-related a[href^="/noticias/"]').count()
    ).toBeGreaterThan(0)

    await validateResponsiveMatrix(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.hf-editorial-article-header').screenshot({
      path: testInfo.outputPath('article-mobile.png'),
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.locator('.hf-editorial-article-header').screenshot({
      path: testInfo.outputPath('article-desktop.png'),
    })
    expect(consoleErrors).toEqual([])
  })

  test('mantiene una portada editorial responsive y sin imágenes rotas', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    const failedImages: string[] = []
    page.on('response', (response) => {
      if (
        response.request().resourceType() === 'image' &&
        response.status() >= 400
      ) {
        failedImages.push(`${response.status()} ${response.url()}`)
      }
    })

    await page.goto('/noticias', { waitUntil: 'load' })
    await expect(page).toHaveTitle(/Noticias/)
    await validateResponsiveMatrix(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.hf-editorial-page-hero').screenshot({
      path: testInfo.outputPath('news-mobile.png'),
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.locator('.hf-editorial-page-hero').screenshot({
      path: testInfo.outputPath('news-desktop.png'),
    })

    expect(failedImages).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('muestra el vacío real del mercado y su guía metodológica', async ({
    page,
  }, testInfo) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/mercado-de-pases', {
      waitUntil: 'domcontentloaded',
    })

    const pageRoot = page.locator('.hf-editorial-page.is-market')
    await expect(pageRoot).toBeVisible()
    await expect(
      pageRoot.getByRole('heading', {
        name: 'Mercado de pases',
        level: 1,
      })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'Todavía no hay movimientos verificados',
      })
    ).toBeVisible()
    await expect(page.locator('.hf-transfer-grid')).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.hf-transfer-empty').screenshot({
      path: testInfo.outputPath('market-empty-mobile.png'),
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.locator('.hf-transfer-empty').screenshot({
      path: testInfo.outputPath('market-empty-desktop.png'),
    })

    const guideLink = page
      .locator('.hf-editorial-card[href^="/mercado-de-pases/"]')
      .first()
    await expect(guideLink).toBeVisible()
    const guideHref = await guideLink.getAttribute('href')
    await guideLink.click()
    await expect(page).toHaveURL(guideHref!)
    await expect(page.locator('.hf-editorial-detail')).toBeVisible()
    await expect(page.locator('.hf-editorial-article-body p').first()).toBeVisible()

    await page.goto('/mercado-de-pases?estado=rumor', {
      waitUntil: 'domcontentloaded',
    })
    await expect(
      page.getByRole('heading', {
        name: 'No hay movimientos con estos filtros',
      })
    ).toBeVisible()
    await page.getByRole('link', { name: 'Limpiar filtros' }).click()
    await expect(page).toHaveURL(/\/mercado-de-pases$/)

    await validateResponsiveMatrix(page)
    expect(consoleErrors).toEqual([])
  })

  test('integra las guías de análisis en el mismo sistema editorial', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/analisis', { waitUntil: 'domcontentloaded' })

    const pageRoot = page.locator('.hf-editorial-page.is-analysis')
    await expect(pageRoot).toBeVisible()
    await expect(
      pageRoot.getByRole('heading', { name: 'Análisis', level: 1 })
    ).toBeVisible()
    const guides = page.locator('.hf-editorial-card[href^="/analisis/"]')
    expect(await guides.count()).toBeGreaterThan(0)

    const guideHref = await guides.first().getAttribute('href')
    await guides.first().click()
    await expect(page).toHaveURL(guideHref!)
    await expect(page.locator('.hf-editorial-detail.is-analysis')).toBeVisible()
    await expect(
      page.locator('.hf-editorial-article-body p').first()
    ).toBeVisible()
    await expect(
      page.locator('script[type="application/ld+json"]')
    ).toHaveCount(1)

    await page.setViewportSize({ width: 320, height: 800 })
    await expectNoDocumentOverflow(page)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expectNoDocumentOverflow(page)
    expect(consoleErrors).toEqual([])
  })
})
