import crypto from 'node:crypto'

export function isLineConfigured() {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET)
}

export function verifyLineSignature(rawBody, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET || ''
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
  return expected === signature
}

export function parseLineWebhook(body) {
  if (!body || !Array.isArray(body.events)) return []
  return body.events
}

export function buildLineTextReply(text) {
  return {
    type: 'text',
    text,
  }
}

export function extractLineTextEvent(event) {
  if (!event || event.type !== 'message') return null
  if (!event.message || event.message.type !== 'text') return null
  return {
    replyToken: event.replyToken,
    userId: event.source?.userId || 'unknown',
    text: String(event.message.text || '').trim(),
  }
}

export async function sendLineReply(replyToken, messages) {
  if (!isLineConfigured()) {
    throw new Error('LINE is not configured')
  }

  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `LINE reply failed: ${response.status}`)
  }
}

export function getLineConfigMeta() {
  return {
    configured: isLineConfigured(),
    hasChannelAccessToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
    hasChannelSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
  }
}
