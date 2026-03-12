import { chromium } from 'playwright'

const url = 'https://ai-gym-updated.vercel.app'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
const consoleMessages = []
const pageErrors = []

page.on('console', (msg) => {
  consoleMessages.push({ type: msg.type(), text: msg.text() })
})
page.on('pageerror', (error) => {
  pageErrors.push(String(error))
})

await page.goto(url, { waitUntil: 'networkidle' })
await page.locator('a[href="#admin-snapshot"]').first().click()
await page.locator('#admin-snapshot').scrollIntoViewIfNeeded()

const firstRow = page.locator('.booking-table tbody tr').first()
await firstRow.click()
await page.locator('.detail-panel').waitFor()

const nameInput = page.locator('label.detail-field').filter({ hasText: '姓名' }).locator('input')
const originalName = (await nameInput.inputValue()).trim()
const editedName = `${originalName}-QA`
await nameInput.fill(editedName)
await page.getByRole('button', { name: '儲存明細' }).click()
await page.waitForTimeout(1500)

const editedRowName = await page.locator('.booking-table tbody tr td:nth-child(3) strong').first().textContent()
const countAfterSave = await page.locator('.booking-table tbody tr').count()

await page.reload({ waitUntil: 'networkidle' })
await page.locator('a[href="#admin-snapshot"]').first().click()
await page.locator('#admin-snapshot').scrollIntoViewIfNeeded()
await page.waitForTimeout(500)

const firstNameAfterReload = await page.locator('.booking-table tbody tr td:nth-child(3) strong').first().textContent()
const countAfterReload = await page.locator('.booking-table tbody tr').count()
const duplicateEditedNames = await page.locator('.booking-table tbody tr td:nth-child(3) strong').evaluateAll((nodes, target) => nodes.map((node) => node.textContent?.trim() || '').filter((value) => value === target).length, editedName)
const notice = (await page.locator('.notice-text').textContent().catch(() => '')) || ''

console.log(JSON.stringify({
  url: page.url(),
  consoleMessages,
  pageErrors,
  originalName,
  editedName,
  editedRowName,
  firstNameAfterReload,
  countAfterSave,
  countAfterReload,
  duplicateEditedNames,
  notice,
}, null, 2))

await browser.close()
