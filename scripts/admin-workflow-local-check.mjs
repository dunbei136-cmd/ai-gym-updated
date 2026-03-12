import { spawn } from 'node:child_process'
import net from 'node:net'
import { chromium } from 'playwright'

const host = '127.0.0.1'
const children = []
let apiPort = '8788'
let clientPort = '4175'
let apiBaseUrl = `http://${host}:${apiPort}`
let appUrl = `http://${host}:${clientPort}`

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, host, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(String(port)))
    })
  })
}

function start(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, ...extraEnv },
  })

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`)
  })
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`)
  })

  children.push(child)
  return child
}

async function waitFor(check, label, timeoutMs = 30000, intervalMs = 500) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await check()) return
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function cleanup() {
  await Promise.all(
    children.map(
      (child) =>
        new Promise((resolve) => {
          if (child.killed) {
            resolve(undefined)
            return
          }

          let settled = false
          const finish = () => {
            if (settled) return
            settled = true
            resolve(undefined)
          }

          child.once('exit', finish)
          child.kill()
          setTimeout(() => {
            try {
              if (!child.killed) child.kill('SIGKILL')
            } catch {
              // ignore
            }
            finish()
          }, 1500)
        }),
    ),
  )
}

let browser

try {
  apiPort = await getFreePort()
  clientPort = await getFreePort()
  apiBaseUrl = `http://${host}:${apiPort}`
  appUrl = `http://${host}:${clientPort}`

  start('api', 'npm', ['run', 'dev:server'], { PORT: apiPort })
  start('client', 'npm', ['run', 'dev', '--', '--host', host, '--port', clientPort], {
    VITE_API_MODE: 'http',
    VITE_API_BASE_URL: apiBaseUrl,
  })

  await waitFor(async () => {
    const response = await fetch(`${apiBaseUrl}/health`)
    return response.ok
  }, 'API health')

  await waitFor(async () => {
    const response = await fetch(appUrl)
    return response.ok
  }, 'client app')

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })

  await page.goto(appUrl, { waitUntil: 'networkidle' })
  await page.locator('a[href="#admin-snapshot"]').first().click()
  await page.locator('#admin-snapshot').scrollIntoViewIfNeeded()

  const adminSection = page.locator('#admin-snapshot')
  const quickCreate = adminSection.locator('.admin-create-panel')
  const uniqueSeed = `${Date.now()}`.slice(-8)
  const phone = `09${uniqueSeed}`.slice(0, 10)
  const email = `workflow-${uniqueSeed}@example.com`
  const name = `工作流測試${uniqueSeed.slice(-3)}`

  await quickCreate.getByLabel('姓名').fill(name)
  await quickCreate.getByLabel('手機號碼').fill(phone)
  await quickCreate.getByLabel('Email').fill(email)
  await quickCreate.getByRole('button', { name: '新增 booking' }).click()

  await page.locator('.detail-panel').waitFor()
  await page.locator('.detail-panel .detail-field').filter({ hasText: '名單階段' }).locator('select').selectOption('已聯繫')
  await page.locator('.detail-panel .detail-field').filter({ hasText: '負責人' }).locator('input').fill('Workflow QA')
  await page.locator('.activity-draft-row input').fill('已完成本地 workflow 測試')
  await page.getByRole('button', { name: '新增紀錄' }).click()
  await page.getByRole('button', { name: '儲存明細' }).click()

  await page.waitForTimeout(1200)

  await page.getByRole('button', { name: '清除篩選' }).click().catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('.pipeline-column').filter({ hasText: '已聯繫' }).locator('.pipeline-mini-card', { hasText: name }).first().dragTo(
    page.locator('.pipeline-column').filter({ hasText: '已成交' }).first(),
  )

  await page.waitForTimeout(1200)
  await page.locator('.pipeline-column').filter({ hasText: '已成交' }).locator('.pipeline-mini-card', { hasText: name }).first().click()
  await page.locator('.detail-panel').waitFor()

  const stageValue = await page.locator('.detail-panel .detail-field').filter({ hasText: /^名單階段/ }).locator('select').inputValue()
  const assigneeValue = await page.locator('.detail-panel .detail-field').filter({ hasText: /^負責人/ }).locator('input').first().inputValue()
  const activityItems = await page.locator('.activity-log-item p').allTextContents()
  const noticeText = (await page.locator('.notice-text').textContent().catch(() => '')) || ''

  console.log(
    JSON.stringify(
      {
        appUrl,
        createdBooking: { name, phone, email },
        stageValue,
        assigneeValue,
        activityLogCount: activityItems.length,
        activityLogPreview: activityItems.slice(0, 6),
        hasManualActivityEntry: activityItems.some((item) => item.includes('已完成本地 workflow 測試')),
        hasAutoStageEntry: activityItems.some((item) => item.includes('名單階段改為 已成交')),
        noticeText,
      },
      null,
      2,
    ),
  )

  await browser.close()
  await cleanup()
} catch (error) {
  if (browser) {
    await browser.close().catch(() => undefined)
  }
  await cleanup().catch(() => undefined)
  console.error(error)
  process.exit(1)
}
