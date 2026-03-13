import http from 'node:http'
import { getDbMeta, listBookings, lookupBooking, updateBookingDetails, updateBookingStatus, upsertBooking } from './db.mjs'
import { generateChatReply, getAiMeta } from './ai.mjs'

const port = Number(process.env.PORT || 8787)

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  res.end(JSON.stringify(data))
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    })
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    json(res, 200, { ok: true, service: 'pulsefit-api', db: getDbMeta(), ai: getAiMeta() })
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
      json(res, 404, { error: 'Booking not found' })
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
        json(res, 400, { error: 'name, phone, email are required' })
        return
      }

      const program = resolveProgram(goal)
      const booking = upsertBooking({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        className: program.className,
        trainer: program.trainer,
        date: resolveSlot(preferredSlot),
        status: '待回覆',
      })

      json(res, 201, booking)
    } catch (error) {
      json(res, 400, { error: error.message || 'Failed to create booking' })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/bookings/status') {
    try {
      const body = await collectBody(req)
      const { phone = '', email = '', status = '' } = body

      if (!phone.trim() || !email.trim() || !status) {
        json(res, 400, { error: 'phone, email, status are required' })
        return
      }

      const updated = updateBookingStatus(phone, email, status)
      if (!updated) {
        json(res, 404, { error: 'Booking not found' })
        return
      }

      json(res, 200, updated)
    } catch (error) {
      json(res, 400, { error: error.message || 'Failed to update booking status' })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/bookings/details') {
    try {
      const body = await collectBody(req)
      const { phone = '', email = '', name = '', className = '', trainer = '', date = '' } = body

      if (!phone.trim() || !email.trim() || !name.trim() || !className.trim() || !trainer.trim() || !date.trim()) {
        json(res, 400, { error: 'phone, email, name, className, trainer, date are required' })
        return
      }

      const updated = updateBookingDetails(phone, email, {
        name: name.trim(),
        className: className.trim(),
        trainer: trainer.trim(),
        date: date.trim(),
      })
      if (!updated) {
        json(res, 404, { error: 'Booking not found' })
        return
      }

      json(res, 200, updated)
    } catch (error) {
      json(res, 400, { error: error.message || 'Failed to update booking details' })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/chat') {
    try {
      const body = await collectBody(req)
      const result = await generateChatReply(body.message)
      json(res, 200, result)
    } catch (error) {
      json(res, 400, { error: error.message || 'Failed to process chat' })
    }
    return
  }

  json(res, 404, { error: 'Not found' })
})

server.listen(port, () => {
  console.log(`PulseFit API listening on http://127.0.0.1:${port}`)
  console.log(`Database: ${getDbMeta().path}`)
})
