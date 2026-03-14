const metrics = {
  chat: {
    total: 0,
    fallback: 0,
    openai: 0,
    gemini: 0,
    lastMessageAt: '',
  },
  validation: {
    total: 0,
    byRoute: {},
    lastErrorAt: '',
    lastRoute: '',
  },
  line: {
    webhooks: 0,
    events: 0,
    replies: 0,
    lastWebhookAt: '',
  },
}

function stamp() {
  return new Date().toISOString()
}

export function recordChatResult(mode) {
  metrics.chat.total += 1
  metrics.chat.lastMessageAt = stamp()

  if (mode === 'fallback') metrics.chat.fallback += 1
  if (mode === 'openai') metrics.chat.openai += 1
  if (mode === 'gemini') metrics.chat.gemini += 1
}

export function recordValidationError(route) {
  metrics.validation.total += 1
  metrics.validation.lastErrorAt = stamp()
  metrics.validation.lastRoute = route
  metrics.validation.byRoute[route] = (metrics.validation.byRoute[route] || 0) + 1
}

export function recordLineWebhook(eventsCount = 0) {
  metrics.line.webhooks += 1
  metrics.line.events += Number(eventsCount) || 0
  metrics.line.lastWebhookAt = stamp()
}

export function recordLineReply() {
  metrics.line.replies += 1
}

export function getMetrics() {
  const chatFallbackRate = metrics.chat.total > 0 ? Number((metrics.chat.fallback / metrics.chat.total).toFixed(3)) : 0

  return {
    chat: {
      ...metrics.chat,
      fallbackRate: chatFallbackRate,
    },
    validation: {
      ...metrics.validation,
    },
    line: {
      ...metrics.line,
    },
  }
}
