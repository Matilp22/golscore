import { expect, test, type Page } from '@playwright/test'

import { prepareReadOnlyPage } from './read-only-page'

const COMPLETE_FIXTURE = '1547783'
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

async function validateResponsiveWidths(page: Page) {
  for (const width of RESPONSIVE_WIDTHS) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 })
    await expectNoOverflow(page)
  }
}

test.describe('Paridad de rutas y capacidades transversales', () => {
  test('integra el historial de partido al sistema nuevo con datos reales', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto(`/partido/${COMPLETE_FIXTURE}/historial`, {
      waitUntil: 'domcontentloaded',
    })

    const history = page.locator('[data-match-history-page="true"]')
    await expect(history).toBeVisible()
    await expect(history.getByRole('heading', { level: 1 })).toContainText(
      ' vs '
    )
    await expect(
      history.getByRole('link', { name: 'Volver al partido' })
    ).toHaveAttribute('href', `/partido/${COMPLETE_FIXTURE}`)
    await expect(page.locator('.hf-history-summary > div')).toHaveCount(5)

    const matches = page.locator('.hf-history-match')
    const empty = page.locator('.hf-history-empty')
    expect((await matches.count()) + (await empty.count())).toBeGreaterThan(0)

    await validateResponsiveWidths(page)
    expect(consoleErrors).toEqual([])
  })

  test('muestra el palmarés mundialista sin tablas horizontales', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/liga/selecciones-mundial/campeones', {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.getByRole('heading', { name: 'Campeones del mundo', level: 1 })
    ).toBeVisible()
    expect(await page.locator('.hf-champions-ranking-grid article').count()).toBeGreaterThan(
      5
    )
    await expect(page.locator('.hf-champions-final')).toHaveCount(22)
    await expect(
      page.locator('.hf-champions-final').filter({ hasText: '2022' })
    ).toContainText('Argentina')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/liga\/selecciones-mundial\/campeones$/
    )

    await validateResponsiveWidths(page)
    expect(consoleErrors).toEqual([])
  })

  test('presenta un partido inexistente como estado de producto', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/partido/0', { waitUntil: 'domcontentloaded' })

    await expect(
      page.getByRole('heading', { name: 'Partido no encontrado', level: 1 })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Volver a la agenda' })
    ).toHaveAttribute('href', '/')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/
    )
    await validateResponsiveWidths(page)
    expect(consoleErrors).toEqual([])
  })

  test('abre el historial de campeones de una competencia con teclado', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/liga/internacional-libertadores', {
      waitUntil: 'domcontentloaded',
    })

    const trigger = page.getByRole('button', { name: 'Campeones' })
    await trigger.click()
    const dialog = page.getByRole('dialog', {
      name: /Copa Libertadores/i,
    })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'Cerrar' })
    ).toBeFocused()
    expect(await dialog.locator('article').count()).toBeGreaterThan(5)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()

    await page.setViewportSize({ width: 320, height: 800 })
    await expectNoOverflow(page)
    expect(consoleErrors).toEqual([])
  })

  test('conserva instalación PWA e idioma como acciones reales', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).toHaveAttribute(
      'data-pwa-install-listener',
      'ready'
    )

    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true })
      Object.defineProperties(event, {
        prompt: {
          value: async () => {
            window.localStorage.setItem('hf:qa-install-prompted', '1')
          },
        },
        userChoice: {
          value: Promise.resolve({
            outcome: 'accepted',
            platform: 'qa',
          }),
        },
      })
      window.dispatchEvent(event)
    })

    const installDialog = page.getByRole('dialog', {
      name: 'Instalar Hay Fulbo',
    })
    await expect(installDialog).toBeVisible()
    await installDialog.getByRole('button', {
      name: 'Instalar Hay Fulbo',
    }).click()
    await expect(installDialog).toBeHidden()
    expect(
      await page.evaluate(() =>
        window.localStorage.getItem('hf:qa-install-prompted')
      )
    ).toBe('1')

    const language = page.locator('.hf-language-selector-control')
    await language.selectOption('en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    expect(await page.context().cookies()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'hf_locale', value: 'en' }),
      ])
    )

    await validateResponsiveWidths(page)
    expect(consoleErrors).toEqual([])
  })

  test('integra el juego editorial con interacción, foco y pistas reales', async ({
    page,
  }) => {
    const consoleErrors = await prepareReadOnlyPage(page)
    await page.goto('/juegos/adivina-el-futbolista', {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.getByRole('heading', { name: /Quién es el futbolista/i, level: 1 })
    ).toBeVisible()
    await page.getByRole('button', { name: /Fácil/i }).click()

    const answer = page.getByLabel('¿Quién es?')
    await expect(answer).toBeFocused()
    await answer.fill('Un jugador inexistente')
    await page.getByRole('button', { name: 'PROBAR' }).click()
    await expect(page.getByText(/No es ese/i)).toBeVisible()

    const nationalityClue = page.getByRole('button', { name: 'Nacionalidad' })
    await nationalityClue.click()
    await expect(nationalityClue).toBeDisabled()
    await expect(
      page.locator('small').filter({ hasText: /^Nacionalidad$/ })
    ).toBeVisible()

    await page.setViewportSize({ width: 320, height: 800 })
    await expectNoOverflow(page)
    expect(consoleErrors).toEqual([])
  })
})
