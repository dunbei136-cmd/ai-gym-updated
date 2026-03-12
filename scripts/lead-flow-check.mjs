import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
const unique = Date.now().toString().slice(-8)
const phone = `09${unique}`.slice(0, 10)
const email = `qa-${unique}@example.com`

await page.goto('https://ai-gym-updated.vercel.app', { waitUntil: 'networkidle' })
await page.locator('#lead-capture').scrollIntoViewIfNeeded()

const leadSection = page.locator('#lead-capture').locator('.section-card').first()
await leadSection.getByLabel('姓名').fill('線上測試')
await leadSection.getByLabel('手機號碼').fill(phone)
await leadSection.getByLabel('Email').fill(email)
await leadSection.getByRole('button', { name: '送出體驗課需求' }).click()
await page.waitForTimeout(1200)

await page.locator('#booking-lookup').scrollIntoViewIfNeeded()
const lookupSection = page.locator('#booking-lookup')
await lookupSection.getByLabel('手機號碼').fill(phone)
await lookupSection.getByLabel('Email').fill(email)
await page.waitForTimeout(1200)

const bookingCardText = await lookupSection.locator('.booking-card').textContent()
const status = await lookupSection.locator('.status-pill').textContent().catch(() => '')
const matchedName = await lookupSection.locator('h3').textContent().catch(() => '')

console.log(JSON.stringify({ phone, email, status, matchedName, bookingCardText }, null, 2))
await browser.close()
