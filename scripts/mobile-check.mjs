import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })

await page.goto('https://ai-gym-updated.vercel.app', { waitUntil: 'networkidle' })
const homeMetrics = await page.evaluate(() => ({
  innerWidth: window.innerWidth,
  bodyScrollWidth: document.body.scrollWidth,
  docScrollWidth: document.documentElement.scrollWidth,
}))
await page.screenshot({ path: 'C:/Users/dunbe/.openclaw/workspace/.openclaw/home-mobile.png', fullPage: true })

await page.locator('a[href="#admin-snapshot"]').first().click()
await page.locator('#admin-snapshot').scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
const adminMetrics = await page.evaluate(() => ({
  innerWidth: window.innerWidth,
  bodyScrollWidth: document.body.scrollWidth,
  docScrollWidth: document.documentElement.scrollWidth,
}))
await page.screenshot({ path: 'C:/Users/dunbe/.openclaw/workspace/.openclaw/admin-mobile.png', fullPage: true })

console.log(JSON.stringify({ homeMetrics, adminMetrics }, null, 2))
await browser.close()
