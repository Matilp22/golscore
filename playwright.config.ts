import { defineConfig, devices } from '@playwright/test'

const port = 3128
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run start -- -p ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          FOOTBALL_PUBLIC_READ_MODE: 'cache-only',
          HOME_READ_MODE: 'cache-only',
          LEAGUE_READ_MODE: 'cache-only',
          MATCH_DETAIL_READ_MODE: 'cache-only',
          PRODE_READ_MODE: 'cache-only',
        },
      },
})
