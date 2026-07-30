import type { Page } from '@playwright/test'

const EXTERNAL_CONSOLE_ERRORS = [
  'googlesyndication',
  'googleads',
  'static.doubleclick.net',
  '_vercel/insights',
  'ERR_BLOCKED_BY_CLIENT',
]

export async function prepareReadOnlyPage(page: Page) {
  const goto = page.goto.bind(page)

  page.goto = ((url, options) =>
    goto(url, {
      ...options,
      // Interactive assertions require the client chunks to be loaded. Waiting
      // only for DOMContentLoaded can race React hydration on cold deployments.
      waitUntil: 'load',
    })) as Page['goto']

  for (const endpoint of [
    '**/api/home/live-sync**',
    '**/api/match-detail/live-sync**',
  ]) {
    await page.route(endpoint, async (route) => {
      await route.fulfill({
        status: 204,
        body: '',
      })
    })
  }

  const internalErrors: string[] = []
  page.on('console', (message) => {
    const source = `${message.text()} ${message.location().url}`
    if (
      message.type() === 'error' &&
      !EXTERNAL_CONSOLE_ERRORS.some((allowed) => source.includes(allowed))
    ) {
      internalErrors.push(source.trim())
    }
  })
  page.on('pageerror', (error) => {
    internalErrors.push(error.message)
  })

  return internalErrors
}
