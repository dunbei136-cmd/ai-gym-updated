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
  const name = `邊界測試${index + 1}`
  createdNames.push(name)
  await quickCreate.getByLabel('姓名').fill(name)
  await quickCreate.getByLabel('手機號碼').fill(`09${suffix}`.slice(0, 10))
  await quickCreate.getByLabel('Email').fill(`edge-${suffix}-${index}@example.com`)
  await quickCreate.getByRole('button', { name: '新增 booking' }).click()
  await page.waitForTimeout(500)
}

for (const name of createdNames) {
  const row = adminSection.locator('.booking-table tbody tr', { has: page.locator(`td strong:text-is("${name}")`) }).first()
  await row.locator('input[type="checkbox"]').check()
}

await adminSection.locator('.batch-toolbar select').selectOption('已確認')
await adminSection.getByRole('button', { name: '批次改狀態' }).click()
await page.waitForTimeout(800)
const selectionClearedAfterBatch = !(await adminSection.getByRole('button', { name: '只看已勾選' }).isEnabled())

for (const name of createdNames) {
  const row = adminSection.locator('.booking-table tbody tr', { has: page.locator(`td strong:text-is("${name}")`) }).first()
  await row.locator('input[type="checkbox"]').check()
}

await adminSection.getByRole('button', { name: '只看已勾選' }).click()
await page.waitForTimeout(500)
const selectedOnlyText = (await adminSection.locator('.booking-table tbody').textContent()) || ''
const selectedOnlyOk = createdNames.every((name) => selectedOnlyText.includes(name))

const firstSelectedRow = adminSection.locator('.booking-table tbody tr').first()
await firstSelectedRow.click()
await page.locator('.detail-panel').waitFor()
const detailNameInput = page.locator('label.detail-field').filter({ hasText: '姓名' }).locator('input')
await detailNameInput.fill(`${createdNames[0]}-dirty`)

let cancelDialogMessage = ''
page.once('dialog', async (dialog) => {
  cancelDialogMessage = dialog.message()
  await dialog.dismiss()
})
await page.getByRole('button', { name: '關閉' }).click()
await page.waitForTimeout(300)
const detailStillVisibleAfterCancel = await page.locator('.detail-panel').isVisible()

let acceptDialogMessage = ''
page.once('dialog', async (dialog) => {
  acceptDialogMessage = dialog.message()
  await dialog.accept()
})
await page.getByRole('button', { name: '關閉' }).click()
await page.waitForTimeout(500)
const detailVisibleAfterAccept = await page.locator('.detail-panel').isVisible().catch(() => false)

for (const name of createdNames) {
  const row = adminSection.locator('.booking-table tbody tr', { has: page.locator(`td strong:text-is("${name}")`) }).first()
  await row.locator('input[type="checkbox"]').check()
}

let deleteDialogMessage = ''
page.once('dialog', async (dialog) => {
  deleteDialogMessage = dialog.message()
  await dialog.accept()
})
await adminSection.getByRole('button', { name: '批次刪除' }).click()
await page.waitForTimeout(1000)
const textAfterDelete = (await adminSection.textContent()) || ''
const deletedOk = createdNames.every((name) => !textAfterDelete.includes(name))

console.log(JSON.stringify({
  createdNames,
  selectionClearedAfterBatch,
  selectedOnlyOk,
  cancelDialogMessage,
  detailStillVisibleAfterCancel,
  acceptDialogMessage,
  detailVisibleAfterAccept,
  deleteDialogMessage,
  deletedOk,
}, null, 2))

await browser.close()
