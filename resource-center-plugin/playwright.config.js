import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: process.env.DSH_E2E_URL || 'http://127.0.0.1:3080',
    headless: true,
    trace: 'retain-on-failure',
  },
})
