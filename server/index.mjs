import http from 'node:http'
import { clearSessionFromRequest, authenticateAdmin, requireSession } from './auth.mjs'
import { appendAuditEntry, listAuditEntries } from './audit.mjs'
import { deleteBooking, getDbMeta, listBookings, lookupBooking, updateBookingDetails, updateBookingStatus, upsertBooking } from './db.mjs'
import { generateChatReply, getAiMeta } from './ai.mjs'

const port = Number(process.env.PORT || 8787)
const validStatuses = new Set(['待回覆', '已確認', '已完成'])
const validStages = new Set(['新名單', '已聯繫', '已預約體驗', '已成交', '流失'])
const validSources = new Set(['網站表單', 'AI 聊天', 'LINE', '電話', 'Walk-in'])

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  })
  res.end(JSON.stringify(data))
}

function sendError(res, status, code, message) {
  json(res, status, {
    ok: false,
    error: {
      code,
      message,
    },
  })
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
    json(res, 200, { ok: true, service: 'pulsefit-api', db: getDbMeta(), ai: getAiMeta() })
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
      const username = typeof body.username === 'string' ? body.username.trim() : ''
      const password = typeof body.password === 'string' ? body.password : ''

      if (!username || !password) {
        sendError(res, 400, 'VALIDATION_ERROR', 'username and password are required')
        return
      }

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
    const phone = (url.searchParams.get('phone') || '').trim()
    const email = (url.searchParams.get('email') || '').trim().toLowerCase()
    const found = lookupBooking(phone, email)

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
      const { name = '', phone = '', email = '', goal = '減脂 / 新手入門', preferredSlot = '平日晚上' } = body

      if (!name.trim() || !phone.trim() || !email.trim()) {
        sendError(res, 400, 'VALIDATION_ERROR', 'name, phone, email are required')
        return
      }

      const now = new Date().toISOString()
      const program = resolveProgram(goal)
      const booking = upsertBooking({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
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
      const { phone = '', email = '', status = '' } = body

      if (!phone.trim() || !email.trim() || !status) {
        sendError(res, 400, 'VALIDATION_ERROR', 'phone, email, status are required')
        return
      }

      if (!validStatuses.has(status)) {
        sendError(res, 400, 'VALIDATION_ERROR', 'status is invalid')
        return
      }

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
      const {
        phone = '',
        email = '',
        name = '',
        className = '',
        trainer = '',
        date = '',
        notes = '',
        stage = '新名單',
        source = '網站表單',
        assignee = '未指派',
        nextFollowUpAt = '',
        activityLog = [],
      } = body

      if (!phone.trim() || !email.trim() || !name.trim() || !className.trim() || !trainer.trim() || !date.trim()) {
        sendError(res, 400, 'VALIDATION_ERROR', 'phone, email, name, className, trainer, date are required')
        return
      }

      if (!validStages.has(stage)) {
        sendError(res, 400, 'VALIDATION_ERROR', 'stage is invalid')
        return
      }

      if (!validSources.has(source)) {
        sendError(res, 400, 'VALIDATION_ERROR', 'source is invalid')
        return
      }

      const updated = updateBookingDetails(phone, email, {
        name: name.trim(),
        className: className.trim(),
        trainer: trainer.trim(),
        date: date.trim(),
        notes: typeof notes === 'string' ? notes.trim() : '',
        stage,
        source,
        assignee: typeof assignee === 'string' ? assignee.trim() || '未指派' : '未指派',
        nextFollowUpAt: typeof nextFollowUpAt === 'string' ? nextFollowUpAt : '',
        activityLog: Array.isArray(activityLog) ? activityLog.filter((entry) => typeof entry === 'string') : [],
      })
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
      const { phone = '', email = '' } = body

      if (!phone.trim() || !email.trim()) {
        sendError(res, 400, 'VALIDATION_ERROR', 'phone and email are required')
        return
      }

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
      if (typeof body.message !== 'string' || body.message.trim().length < 2) {
        sendError(res, 400, 'VALIDATION_ERROR', 'message must be at least 2 characters')
        return
      }

      const result = await generateChatReply(body.message)
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
