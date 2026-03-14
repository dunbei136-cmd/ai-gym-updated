import './env.mjs'
import http from 'node:http'
import { clearSessionFromRequest, authenticateAdmin, requireSession } from './auth.mjs'
import { appendAuditEntry, listAuditEntries } from './audit.mjs'
import { deleteBooking, getDbMeta, listBookings, lookupBooking, updateBookingDetails, updateBookingStatus, upsertBooking } from './db.mjs'
import { buildLineTextReply, extractLineTextEvent, getLineConfigMeta, isLineConfigured, parseLineWebhook, sendLineReply, verifyLineSignature } from './integrations/line.mjs'
import { isLikelyEmail, isLikelyPhone, normalizeLineGoal, normalizeLineSlot, resetLineSession, upsertLineSession } from './line-session.mjs'
import { generateChatReply, getAiMeta } from './ai.mjs'
import {
  authLoginSchema,
  bookingLookupSchema,
  chatMessageSchema,
  createBookingSchema,
  deleteBookingSchema,
  parseBody,
  updateBookingDetailsSchema,
  updateBookingStatusSchema,
} from './validation.mjs'

const port = Number(process.env.PORT || 8787)

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  })
  res.end(JSON.stringify(data))
}

function sendError(res, status, code, message, details) {
  json(res, status, {
    ok: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  })
}

function sendValidationError(res, validationError) {
  sendError(res, 400, validationError.code, validationError.message, validationError.details)
}

function resolveProgram(goal) {
  if (goal === '增肌 / 重訓規劃') {
    return { className: '增肌訓練諮詢', trainer: 'Coach Vera' }
  }

  if (goal === '姿勢矯正 / 體態改善') {
    return { className: '體態矯正評估', trainer: 'Coach Max' }
  }

  if (goal === '團體課 / 體驗參觀') {
    return { className: '團體課體驗', trainer: 'Coach Luna' }
  }

  return { className: '新手燃脂體驗課', trainer: 'Coach Aiden' }
}

function resolveSlot(preferredSlot) {
  if (preferredSlot === '平日白天') return '2026/03/20 14:00'
  if (preferredSlot === '週末上午') return '2026/03/21 11:00'
  return '2026/03/20 19:30'
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function requireAuthOrRespond(req, res) {
  const session = requireSession(req)
  if (!session) {
    sendError(res, 401, 'UNAUTHORIZED', '請先登入後台帳號')
    return null
  }
  return session
}

function normalizeChatText(value = '') {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function isGreetingMessage(value = '') {
  const normalized = normalizeChatText(value)
  return /^(hi|hello|hey|你好|哈囉|哈罗|嗨|安安|在嗎|在吗|有人嗎|有人吗)$/.test(normalized)
}

function isSmallTalkMessage(value = '') {
  const normalized = normalizeChatText(value)
  return (
    normalized.includes('你在幹嘛') ||
    normalized.includes('你在干嘛') ||
    normalized.includes('你在做什麼') ||
    normalized.includes('你在做什么') ||
    normalized.includes('忙嗎') ||
    normalized.includes('忙吗') ||
    normalized.includes('你是誰') ||
    normalized.includes('你是谁')
  )
}

function buildLineSoftFallbackReply(input = '') {
  const normalized = normalizeChatText(input)

  if (isGreetingMessage(normalized)) {
    return '哈囉，我在。你想先了解課程、價格，還是直接預約體驗？'
  }

  if (isSmallTalkMessage(normalized)) {
    return '我在啊 😄 你可以直接跟我說想問課程、費用，還是想安排體驗，我幫你接。'
  }

  if (normalized.includes('價格') || normalized.includes('費用') || normalized.includes('多少')) {
    return '可以，我先幫你抓方向。你比較想了解體驗課、月會籍，還是一對一教練課？'
  }

  if (normalized.includes('課') || normalized.includes('推薦') || normalized.includes('新手')) {
    return '可以啊，你直接跟我說你是想減脂、增肌，還是先從新手體驗開始，我幫你縮小到比較適合的課。'
  }

  return '我在，你可以直接跟我說想了解課程、價格、預約，或是查詢目前的 booking，我幫你接下去。'
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    })
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    json(res, 200, { ok: true, service: 'pulsefit-api', db: getDbMeta(), ai: getAiMeta(), line: getLineConfigMeta() })
    return
  }

  if (req.method === 'POST' && url.pathname === '/integrations/line/webhook') {
    let rawBody = ''
    try {
      rawBody = await new Promise((resolve, reject) => {
        let raw = ''
        req.on('data', (chunk) => {
          raw += chunk
          if (raw.length > 1_000_000) {
            reject(new Error('Payload too large'))
            req.destroy()
          }
        })
        req.on('end', () => resolve(raw || '{}'))
        req.on('error', reject)
      })

      if (!isLineConfigured()) {
        sendError(res, 503, 'LINE_NOT_CONFIGURED', 'LINE integration is not configured yet')
        return
      }

      const signature = req.headers['x-line-signature']
      if (typeof signature !== 'string' || !verifyLineSignature(rawBody, signature)) {
        sendError(res, 401, 'INVALID_LINE_SIGNATURE', 'LINE signature verification failed')
        return
      }

      const body = JSON.parse(rawBody)
      const events = parseLineWebhook(body)
      appendAuditEntry({ type: 'line.webhook', actor: 'line', detail: `events=${events.length}` })

      for (const event of events) {
        const textEvent = extractLineTextEvent(event)
        if (!textEvent) continue

        const session = upsertLineSession(textEvent.userId, {})
        const input = textEvent.text
        let replyText = buildLineSoftFallbackReply(input)

        if (input.includes('取消') || input.includes('重來')) {
          resetLineSession(textEvent.userId)
          replyText = '沒問題，我先幫你把這輪流程清掉；你等等直接再說一次「我要預約」或「我要查詢」就好。'
        } else if (input.includes('停車')) {
          replyText = '有，附近有合作停車場跟路邊停車格；如果你是第一次來，我會建議提早 10 分鐘到，找車位跟報到都比較從容。'
        } else if (input.includes('查詢')) {
          upsertLineSession(textEvent.userId, { step: 'ask_lookup_phone', form: {} })
          replyText = '可以，我幫你查。先把預約時留的手機號碼給我。'
        } else if (input.includes('預約')) {
          upsertLineSession(textEvent.userId, { step: 'ask_name', form: {} })
          replyText = '好，我先幫你安排。先跟我說你的姓名就可以。'
        } else if (session.step === 'ask_name') {
          upsertLineSession(textEvent.userId, { step: 'ask_phone', form: { name: input } })
          replyText = `收到，${input} 你好。接著給我你的手機號碼，我幫你把預約資料補齊。`
        } else if (session.step === 'ask_phone') {
          if (!isLikelyPhone(input)) {
            replyText = '我這邊看手機格式有點怪，麻煩你再傳一次手機號碼給我。'
          } else {
            upsertLineSession(textEvent.userId, { step: 'ask_email', form: { phone: input.replace(/[^\d]/g, '') } })
            replyText = '好，手機收到了。再給我一個 Email，之後方便幫你確認預約。'
          }
        } else if (session.step === 'ask_email') {
          if (!isLikelyEmail(input)) {
            replyText = 'Email 格式看起來不太對，請再輸入一次。'
          } else {
            upsertLineSession(textEvent.userId, { step: 'ask_goal', form: { email: input.trim().toLowerCase() } })
            replyText = '你這次主要目標是減脂、增肌、體態調整，還是想先參觀團課呢？'
          }
        } else if (session.step === 'ask_goal') {
          upsertLineSession(textEvent.userId, { step: 'ask_slot', form: { goal: normalizeLineGoal(input) } })
          replyText = '最後一題：你偏好的時段是平日晚上、平日白天，還是週末上午？'
        } else if (session.step === 'ask_lookup_phone') {
          if (!isLikelyPhone(input)) {
            replyText = '我這邊看手機格式有點怪，麻煩你再傳一次預約時留的手機號碼。'
          } else {
            upsertLineSession(textEvent.userId, { step: 'ask_lookup_email', form: { phone: input.replace(/[^\\d]/g, '') } })
            replyText = '收到，接著把預約時留的 Email 給我。'
          }
        } else if (session.step === 'ask_lookup_email') {
          if (!isLikelyEmail(input)) {
            replyText = 'Email 格式看起來不太對，麻煩你再傳一次。'
          } else {
            const lookupEmail = input.trim().toLowerCase()
            const found = lookupBooking(session.form?.phone || '', lookupEmail)
            resetLineSession(textEvent.userId)
            replyText = found
              ? `我查到了：${found.name} 目前預約 ${found.date}，狀態是「${found.status}」，名單階段是「${found.stage}」。`
              : '我這邊暫時找不到這筆預約，麻煩你再確認手機與 Email 是否和當初填寫的一樣。'
          }
        } else if (session.step === 'ask_slot') {
          const finalSession = upsertLineSession(textEvent.userId, {
            step: 'complete',
            form: { preferredSlot: normalizeLineSlot(input) },
          })
          const form = finalSession.form
          const now = new Date().toISOString()
          const program = resolveProgram(form.goal)
          const booking = upsertBooking({
            name: form.name || 'LINE 用戶',
            phone: form.phone || '',
            email: form.email || `${textEvent.userId}@line.local`,
            className: program.className,
            trainer: program.trainer,
            date: resolveSlot(form.preferredSlot || '平日晚上'),
            status: '待回覆',
            notes: '來自 LINE webhook 對話預約',
            stage: '新名單',
            source: 'LINE',
            assignee: '未指派',
            nextFollowUpAt: '',
            activityLog: [`${now.slice(0, 16).replace('T', ' ')} LINE 建立名單`],
          })
          appendAuditEntry({ type: 'line.booking.create', actor: textEvent.userId, detail: `${booking.name} / ${booking.phone}` })
          resetLineSession(textEvent.userId)
          replyText = `已收到你的預約需求，姓名 ${booking.name}，我們會以 ${booking.phone} / ${booking.email} 幫你建立資料，稍後由教練或客服跟你確認。`
        }

        await sendLineReply(textEvent.replyToken, [buildLineTextReply(replyText)])
      }

      json(res, 200, { ok: true, received: events.length })
    } catch (error) {
      sendError(res, 400, 'INVALID_LINE_WEBHOOK', error.message || 'Failed to process LINE webhook')
    }
    return
  }

  if (req.method === 'GET' && url.pathname === '/auth/session') {
    const session = requireSession(req)
    json(res, 200, { ok: true, session: session ?? null })
    return
  }

  if (req.method === 'POST' && url.pathname === '/auth/login') {
    try {
      const body = await collectBody(req)
      const parsed = parseBody(authLoginSchema, body)
      if (!parsed.ok) {
        sendValidationError(res, parsed.error)
        return
      }

      const { username, password } = parsed.data
      const result = authenticateAdmin(username, password)
      if (!result) {
        sendError(res, 401, 'INVALID_CREDENTIALS', '帳號或密碼錯誤')
        return
      }

      appendAuditEntry({ type: 'auth.login', actor: username, detail: 'Admin login success' })
      json(res, 200, { ok: true, token: result.token, session: result.session })
    } catch (error) {
      sendError(res, 400, 'INVALID_REQUEST', error.message || 'Failed to login')
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/auth/logout') {
    const session = requireSession(req)
    clearSessionFromRequest(req)
    if (session) {
      appendAuditEntry({ type: 'auth.logout', actor: session.username, detail: 'Admin logout' })
    }
    json(res, 200, { ok: true })
    return
  }

  if (req.method === 'GET' && url.pathname === '/audit/recent') {
    const session = requireAuthOrRespond(req, res)
    if (!session) return

    const limit = Number(url.searchParams.get('limit') || 50)
    json(res, 200, { ok: true, items: listAuditEntries(limit) })
    return
  }

  if (req.method === 'GET' && url.pathname === '/bookings') {
    json(res, 200, listBookings())
    return
  }

  if (req.method === 'GET' && url.pathname === '/bookings/lookup') {
    const parsed = parseBody(bookingLookupSchema, {
      phone: url.searchParams.get('phone') || '',
      email: url.searchParams.get('email') || '',
    })
    if (!parsed.ok) {
      sendValidationError(res, parsed.error)
      return
    }

    const found = lookupBooking(parsed.data.phone, parsed.data.email)

    if (!found) {
      sendError(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found')
      return
    }

    json(res, 200, found)
    return
  }

  if (req.method === 'POST' && url.pathname === '/bookings') {
    try {
      const body = await collectBody(req)
      const parsed = parseBody(createBookingSchema, body)
      if (!parsed.ok) {
        sendValidationError(res, parsed.error)
        return
      }

      const { name, phone, email, goal, preferredSlot } = parsed.data
      const now = new Date().toISOString()
      const program = resolveProgram(goal)
      const booking = upsertBooking({
        name,
        phone,
        email,
        className: program.className,
        trainer: program.trainer,
        date: resolveSlot(preferredSlot),
        status: '待回覆',
        notes: '',
        stage: '新名單',
        source: '網站表單',
        assignee: '未指派',
        nextFollowUpAt: '',
        activityLog: [`${now.slice(0, 16).replace('T', ' ')} 建立名單`],
      })

      appendAuditEntry({ type: 'booking.create', actor: 'public', detail: `${booking.name} / ${booking.email}` })
      json(res, 201, booking)
    } catch (error) {
      sendError(res, 400, 'INVALID_REQUEST', error.message || 'Failed to create booking')
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/bookings/status') {
    const session = requireAuthOrRespond(req, res)
    if (!session) return

    try {
      const body = await collectBody(req)
      const parsed = parseBody(updateBookingStatusSchema, body)
      if (!parsed.ok) {
        sendValidationError(res, parsed.error)
        return
      }

      const { phone, email, status } = parsed.data
      const updated = updateBookingStatus(phone, email, status)
      if (!updated) {
        sendError(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found')
        return
      }

      appendAuditEntry({ type: 'booking.status', actor: session.username, detail: `${updated.name} -> ${updated.status}` })
      json(res, 200, updated)
    } catch (error) {
      sendError(res, 400, 'INVALID_REQUEST', error.message || 'Failed to update booking status')
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/bookings/details') {
    if (!requireAuthOrRespond(req, res)) return

    try {
      const body = await collectBody(req)
      const parsed = parseBody(updateBookingDetailsSchema, body)
      if (!parsed.ok) {
        sendValidationError(res, parsed.error)
        return
      }

      const { phone, email, ...patch } = parsed.data
      const updated = updateBookingDetails(phone, email, patch)
      if (!updated) {
        sendError(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found')
        return
      }

      json(res, 200, updated)
    } catch (error) {
      sendError(res, 400, 'INVALID_REQUEST', error.message || 'Failed to update booking details')
    }
    return
  }

  if (req.method === 'DELETE' && url.pathname === '/bookings') {
    if (!requireAuthOrRespond(req, res)) return

    try {
      const body = await collectBody(req)
      const parsed = parseBody(deleteBookingSchema, body)
      if (!parsed.ok) {
        sendValidationError(res, parsed.error)
        return
      }

      const { phone, email } = parsed.data
      const deleted = deleteBooking(phone, email)
      if (!deleted) {
        sendError(res, 404, 'BOOKING_NOT_FOUND', 'Booking not found')
        return
      }

      json(res, 200, { ok: true })
    } catch (error) {
      sendError(res, 400, 'INVALID_REQUEST', error.message || 'Failed to delete booking')
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/chat') {
    try {
      const body = await collectBody(req)
      const parsed = parseBody(chatMessageSchema, body)
      if (!parsed.ok) {
        sendValidationError(res, parsed.error)
        return
      }

      const result = await generateChatReply(parsed.data.message)
      json(res, 200, result)
    } catch (error) {
      sendError(res, 400, 'INVALID_REQUEST', error.message || 'Failed to process chat')
    }
    return
  }

  sendError(res, 404, 'NOT_FOUND', 'Not found')
})

server.listen(port, () => {
  console.log(`PulseFit API listening on http://127.0.0.1:${port}`)
  console.log(`Database: ${getDbMeta().path}`)
})
