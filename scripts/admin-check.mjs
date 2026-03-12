import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1100 } })
const page = await context.newPage()

await page.goto('https://ai-gym-updated.vercel.app', { waitUntil: 'networkidle' })
await page.locator('a[href="#admin-snapshot"]').first().click()
await page.locator('#admin-snapshot').scrollIntoViewIfNeeded()

const adminSection = page.locator('#admin-snapshot')
const quickCreate = adminSection.locator('.admin-create-panel')

for (let index = 0; index < 4; index += 1) {
  const suffix = `${Date.now()}${index}`.slice(-8)
  await quickCreate.getByLabel('姓名').fill(`分頁測試${index + 1}`)
  await quickCreate.getByLabel('手機號碼').fill(`09${suffix}`.slice(0, 10))
  await quickCreate.getByLabel('Email').fill(`admin-${suffix}-${index}@example.com`)
  await quickCreate.getByRole('button', { name: '新增 booking' }).click()
  await page.waitForTimeout(400)
}

await adminSection.locator('.page-size-label select').selectOption('5')
await page.waitForTimeout(400)
const pageMetaText = (await adminSection.locator('.booking-table-meta-group').textContent()) || ''

await adminSection.locator('.admin-toolbar select').nth(0).selectOption('已確認')
await page.waitForTimeout(500)
const filteredStatuses = await adminSection.locator('.status-pill').allTextContents()
const filteredStatusOk = filteredStatuses.every((status) => status.includes('已確認'))

await adminSection.getByRole('button', { name: '清除篩選' }).click()
await page.waitForTimeout(500)

const downloadPromise = page.waitForEvent('download')
await adminSection.getByRole('button', { name: '匯出 CSV' }).click()
const download = await downloadPromise
const downloadPath = await download.path()
const csvText = downloadPath ? await fs.readFile(downloadPath, 'utf8') : ''
const csvHasCrmHeaders = csvText.includes('名單階段') && csvText.includes('下次追蹤') && csvText.includes('負責人')

console.log(JSON.stringify({
  pageMetaText,
  filteredStatuses,
  filteredStatusOk,
  csvHasCrmHeaders,
  csvPreview: csvText.split('\n').slice(0, 2),
}, null, 2))

await browser.close()
