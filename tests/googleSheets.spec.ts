import { test, expect } from '@playwright/test'
import { columnLetter } from '../src/googleSheets'

test('spreadsheet column labels include V–X and multi-letter columns', () => {
  expect(columnLetter(0)).toBe('A')
  expect(columnLetter(21)).toBe('V')
  expect(columnLetter(23)).toBe('X')
  expect(columnLetter(26)).toBe('AA')
})
test('live source reads the selected tab, preserves context, refreshes, and disconnects', async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(() => {
    window.google = { accounts: { oauth2: {
      initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'test-fixture-token', expires_in: 3600 }) }),
      revoke: (_token, callback) => callback(),
    } } }
  })
  let reads = 0
  await page.route('https://sheets.googleapis.com/**', route => {
    expect(route.request().headers().authorization).toBe('Bearer test-fixture-token')
    if (route.request().url().includes('/values/')) {
      expect(decodeURIComponent(route.request().url())).toContain("'Prioritization'")
      reads++
      const header = Array.from({ length: 24 }, (_, i) => `Header ${i + 1}`)
      const row = Array.from({ length: 24 }, () => '')
      row[0] = `Live work ${reads}`; row[21] = 'V: dependency'; row[22] = 'W: FRM assignment'; row[23] = 'X: PwC assignment'
      return route.fulfill({ json: { values: [header, row] } })
    }
    return route.fulfill({ json: { sheets: [{ properties: { sheetId: 1, title: 'Other tab' } }, { properties: { sheetId: 8496958, title: 'Prioritization' } }] } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Connect Google Sheets' }).click()
  await page.getByLabel('Google OAuth Web client ID').fill('test-client.apps.googleusercontent.com')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  await expect(page.locator('.source-table')).toContainText('Live work 1')
  await expect(page.locator('.source-context')).toContainText(['V', 'W', 'X', 'Header 22', 'Header 23', 'Header 24', 'V: dependency', 'W: FRM assignment', 'X: PwC assignment'])
  expect(await page.evaluate(() => Object.values(localStorage).join(' '))).not.toContain('test-fixture-token')
  await page.getByRole('button', { name: 'Refresh now' }).click()
  await expect(page.locator('.source-table')).toContainText('Live work 2')
  await page.clock.fastForward(5 * 60 * 1000)
  await expect(page.locator('.source-table')).toContainText('Live work 3')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export source for mapping' }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('prioritization-source.json')
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click()
  await expect(page.locator('.source-table')).toHaveCount(0)
  const oldReads = reads
  await page.clock.fastForward(5 * 60 * 1000)
  expect(reads).toBe(oldReads)
})
test('Google access denial is visible and does not overwrite project records', async ({ page }) => {
  await page.addInitScript(() => {
    window.google = { accounts: { oauth2: { initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'test-fixture-token', expires_in: 3600 }) }), revoke: (_token, callback) => callback() } } }
  })
  await page.route('https://sheets.googleapis.com/**', route => route.fulfill({ status: 403, json: { error: { message: 'denied' } } }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Connect Google Sheets' }).click()
  await page.getByLabel('Google OAuth Web client ID').fill('test-client.apps.googleusercontent.com')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  await expect(page.getByRole('alert')).toContainText('Google denied access')
  await expect(page.locator('.workbook-row.project-row')).toHaveCount(46)
  await expect(page.locator('.source-table')).toHaveCount(0)
})
test('expired authorization pauses refresh and keeps last successfully read data', async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(() => {
    window.google = { accounts: { oauth2: { initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'test-fixture-token', expires_in: 60 }) }), revoke: (_token, callback) => callback() } } }
  })
  await page.route('https://sheets.googleapis.com/**', route => route.fulfill({ json: route.request().url().includes('/values/') ? { values: [['Existing data']] } : { sheets: [{ properties: { sheetId: 8496958, title: 'Prioritization' } }] } }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Connect Google Sheets' }).click()
  await page.getByLabel('Google OAuth Web client ID').fill('test-client.apps.googleusercontent.com')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  await expect(page.locator('.source-table')).toContainText('Existing data')
  await page.clock.fastForward(61000)
  await expect(page.getByRole('alert')).toContainText('session expired')
  await expect(page.locator('.source-table')).toContainText('Existing data')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
})
