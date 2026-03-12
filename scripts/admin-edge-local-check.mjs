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

  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`))
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
  const createdNames = []

  for (let index = 0; index < 3; index += 1) {
    const suffix = `${Date.now()}${index}`.slice(-8)
    const name = `本地邊界測試${index + 1}-${suffix.slice(-3)}`
    createdNames.push(name)
    await quickCreate.getByLabel('姓名').fill(name)
    await quickCreate.getByLabel('手機號碼').fill(`09${suffix}`.slice(0, 10))
    await quickCreate.getByLabel('Email').fill(`edge-local-${suffix}-${index}@example.com`)
    await quickCreate.getByRole('button', { name: '新增 booking' }).click()
    await page.waitForTimeout(300)
  }

  await adminSection.locator('.page-size-label select').selectOption('5')
  await page.waitForTimeout(300)

  const createdRows = adminSection.locator('.booking-table tbody tr')
  await createdRows.first().waitFor()

  for (const name of createdNames) {
    const row = adminSection.locator('.booking-table tbody tr', { hasText: name }).first()
    await row.waitFor()
    await row.locator('input[type="checkbox"]').check({ force: true })
  }

  await adminSection.locator('.batch-toolbar select').first().selectOption('已確認')
  await adminSection.getByRole('button', { name: '批次改狀態' }).click()
  await page.waitForTimeout(800)
  const selectionClearedAfterBatch = !(await adminSection.getByRole('button', { name: '只看已勾選' }).isEnabled())

  await adminSection.getByRole('button', { name: '今天' }).click()
  await page.waitForTimeout(300)
  const filterChipText = (await adminSection.locator('.active-filters').textContent().catch(() => '')) || ''

  await adminSection.getByRole('button', { name: '清空全部' }).click()
  await page.waitForTimeout(300)

  const rowForDirtyCheck = adminSection.locator('.booking-table tbody tr', { hasText: createdNames[0] }).first()
  await rowForDirtyCheck.click()
  await page.locator('.detail-panel').waitFor()
  await page.locator('.detail-panel .detail-field').filter({ hasText: /^姓名/ }).locator('input').fill(`${createdNames[0]}-dirty`)

  let cancelDialogMessage = ''
  page.once('dialog', async (dialog) => {
    cancelDialogMessage = dialog.message()
    await dialog.dismiss()
  })
  await adminSection.locator('.booking-table tbody tr', { hasText: createdNames[1] }).first().click()
  await page.waitForTimeout(300)
  const detailStillVisibleAfterCancel = await page.locator('.detail-panel').isVisible()

  let acceptDialogMessage = ''
  page.once('dialog', async (dialog) => {
    acceptDialogMessage = dialog.message()
    await dialog.accept()
  })
  await adminSection.locator('.booking-table tbody tr', { hasText: createdNames[1] }).first().click()
  await page.waitForTimeout(400)
  const switchedDetailName = await page.locator('.detail-panel .detail-field').filter({ hasText: /^姓名/ }).locator('input').inputValue()

  await page.getByRole('button', { name: '關閉' }).click()
  await page.waitForTimeout(300)

  for (const name of createdNames) {
    const row = adminSection.locator('.booking-table tbody tr', { hasText: name }).first()
    await row.locator('input[type="checkbox"]').check({ force: true })
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

  console.log(
    JSON.stringify(
      {
        appUrl,
        createdNames,
        selectionClearedAfterBatch,
        filterChipText,
        cancelDialogMessage,
        detailStillVisibleAfterCancel,
        acceptDialogMessage,
        switchedDetailName,
        deleteDialogMessage,
        deletedOk,
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
