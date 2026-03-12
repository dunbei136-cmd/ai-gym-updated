import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
const page = await context.newPage()

await page.goto('https://ai-gym-updated.vercel.app', { waitUntil: 'networkidle' })
await page.locator('a[href="#admin-snapshot"]').first().click()
await page.locator('#admin-snapshot').scrollIntoViewIfNeeded()

const adminSection = page.locator('#admin-snapshot')
const quickCreate = adminSection.locator('.admin-create-panel')
const createdNames = []

for (let index = 0; index < 2; index += 1) {
  const suffix = `${Date.now()}${index}`.slice(-8)
  const name = `CRM批次${index + 1}`
  createdNames.push(name)
  await quickCreate.getByLabel('姓名').fill(name)
  await quickCreate.getByLabel('手機號碼').fill(`09${suffix}`.slice(0, 10))
  await quickCreate.getByLabel('Email').fill(`crm-${suffix}-${index}@example.com`)
  await quickCreate.getByRole('button', { name: '新增 booking' }).click()
  await page.waitForTimeout(500)
}

for (const name of createdNames) {
  const row = adminSection.locator('.booking-table tbody tr', { has: page.locator(`td strong:text-is("${name}")`) }).first()
  await row.locator('input[type="checkbox"]').check()
}

await adminSection.locator('.batch-toolbar select').nth(1).selectOption('已聯繫')
await adminSection.locator('.batch-toolbar input[placeholder="批次指定負責人"]').fill('QA Owner')
await adminSection.getByRole('button', { name: '批次改 CRM' }).click()
await page.waitForTimeout(1200)

let stageOk = true
let assigneeOk = true
for (const name of createdNames) {
  const row = adminSection.locator('.booking-table tbody tr', { has: page.locator(`td strong:text-is("${name}")`) }).first()
  const rowText = (await row.textContent()) || ''
  stageOk &&= rowText.includes('已聯繫')
  assigneeOk &&= rowText.includes('QA Owner')
}

console.log(JSON.stringify({ createdNames, stageOk, assigneeOk }, null, 2))
await browser.close()
