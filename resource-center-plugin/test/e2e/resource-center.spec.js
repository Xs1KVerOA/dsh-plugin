import { test, expect } from '@playwright/test'

const enabled = Boolean(process.env.DSH_E2E_URL)

test.describe('DSH Resource Center browser lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!enabled, '设置 DSH_E2E_URL 后运行浏览器 E2E')
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => page.title()).toBe('DSH Center')
  })

  test('right sidebar opens and browser MITM follows the shared listener', async ({ page, request }) => {
    const toggle = page.locator('.W-zNGW_toggleCluster button, .nArs4W_toggleCluster button').last()
    await expect(toggle).toHaveCount(1)
    await toggle.click()
    const panel = page.locator('.W-zNGW_panel:visible, .nArs4W_panel:visible').first()
    await expect(panel).toBeVisible()

    const browserMitm = page.locator('[data-dsh-resource-center-mitm-panel]')
    await expect(browserMitm).toHaveCount(1)
    const action = browserMitm.locator('button').first()
    await expect(action).toBeVisible()
    await action.click()
    await expect.poll(async () => (await request.get('/api/dsh-web-testing/status')).json()).toMatchObject({ proxy: expect.objectContaining({ host: '127.0.0.1' }) })
    await action.click()
    await expect.poll(async () => (await request.get('/api/dsh-web-testing/status')).json()).toMatchObject({ proxy: null })
  })

  test('concurrent proxy start and stop are idempotent', async ({ request }) => {
    const responses = await Promise.all(Array.from({ length: 4 }, () => request.post('/api/dsh-web-testing/proxy/start', { data: { host: '127.0.0.1', port: 0 } })))
    for (const response of responses) await expect(response).toBeOK()
    const endpoints = await Promise.all(responses.map(response => response.json()))
    expect(new Set(endpoints.map(item => `${item.proxy.host}:${item.proxy.port}`)).size).toBe(1)
    await Promise.all(Array.from({ length: 4 }, () => request.post('/api/dsh-web-testing/proxy/stop', { data: {} })))
    await expect.poll(async () => (await request.get('/api/dsh-web-testing/status')).json()).toMatchObject({ proxy: null })
  })

  test('refresh and repeated module mounting do not duplicate controls', async ({ page }) => {
    const openRightSidebar = async () => {
      const visiblePanel = page.locator('.W-zNGW_panel:visible, .nArs4W_panel:visible').first()
      if (await visiblePanel.count() === 0) {
        await page.locator('.W-zNGW_toggleCluster button, .nArs4W_toggleCluster button').last().click()
      }
      await expect(page.locator('.W-zNGW_panel:visible, .nArs4W_panel:visible').first()).toBeVisible()
      await expect(page.locator('[data-dsh-resource-center-mitm-control]')).toHaveCount(1)
    }
    await openRightSidebar()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle('DSH Center')
    await openRightSidebar()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle('DSH Center')
    await openRightSidebar()
  })
})
