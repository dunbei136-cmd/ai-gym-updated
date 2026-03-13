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

export function getLineConfigMeta() {
  return {
    configured: isLineConfigured(),
    hasChannelAccessToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
    hasChannelSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
  }
}
