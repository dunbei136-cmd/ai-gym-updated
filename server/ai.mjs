const aiProvider = process.env.AI_PROVIDER || 'auto'

const openAiApiKey = process.env.OPENAI_API_KEY
const openAiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const openAiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini'

const geminiApiKey = process.env.GEMINI_API_KEY
const geminiBaseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

const systemPrompt =
  'You are PulseFit AI, a gym concierge assistant. Keep replies concise, practical, and sales-aware. Help users understand memberships, trial classes, schedules, and booking lookup steps. If the user asks about booking lookup, remind them to use phone + email.'

const replyCache = new Map()
const cacheTtlMs = Number(process.env.AI_CACHE_TTL_MS || 10 * 60 * 1000)
const maxCacheEntries = Number(process.env.AI_CACHE_MAX || 200)

export function buildFallbackReply(message = '') {
  const normalized = message.trim().toLowerCase()

  if (normalized.includes('會員')) {
    return '目前會先推薦體驗課、月會籍、一對一教練課三種路徑；若你還沒上過，建議先從體驗課開始。'
  }

  if (normalized.includes('新手') || normalized.includes('推薦') || normalized.includes('課')) {
    return '如果你是新手，我會優先推薦「新手燃脂體驗課」或「體態評估 + 教練諮詢」，先確認目標再安排適合的教練。'
  }

  if (normalized.includes('查詢') || normalized.includes('預約') || normalized.includes('booking')) {
    return '可以，請提供手機號碼與 Email，或直接使用 Booking Lookup 頁面查詢預約。'
  }

  return '我是健身房 AI 接待助理，目前可協助 FAQ、方案介紹、體驗課導流與預約查詢。'
}

function normalizeMessage(message = '') {
  return message.trim().replace(/\s+/g, ' ').toLowerCase()
}

function shouldUseFallbackOnly(message = '') {
  const normalized = normalizeMessage(message)
  if (!normalized) return true

  const simpleFaqPatterns = [/會員/, /新手/, /推薦/, /課/, /查詢/, /預約/, /booking/]
  if (normalized.length <= 6) return true
  if (simpleFaqPatterns.some((pattern) => pattern.test(normalized))) return true

  return false
}

function getCachedReply(message = '') {
  const key = normalizeMessage(message)
  if (!key) return null

  const entry = replyCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > cacheTtlMs) {
    replyCache.delete(key)
    return null
  }

  return entry.value
}

function setCachedReply(message = '', value) {
  const key = normalizeMessage(message)
  if (!key) return

  replyCache.set(key, { ts: Date.now(), value })

  if (replyCache.size > maxCacheEntries) {
    const oldestKey = replyCache.keys().next().value
    if (oldestKey) replyCache.delete(oldestKey)
  }
}

async function callOpenAI(message) {
  if (!openAiApiKey) throw new Error('OpenAI key missing')

  const response = await fetch(`${openAiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: openAiModel,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI HTTP ${response.status}`)
  }

  const data = await response.json()
  const reply = data?.choices?.[0]?.message?.content?.trim()

  if (!reply) throw new Error('OpenAI returned empty reply')

  return {
    mode: 'openai',
    reply,
  }
}

async function callGemini(message) {
  if (!geminiApiKey) throw new Error('Gemini key missing')

  const response = await fetch(
    `${geminiBaseUrl}/models/${geminiModel}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: message }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
        },
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status}`)
  }

  const data = await response.json()
  const reply = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('').trim()

  if (!reply) throw new Error('Gemini returned empty reply')

  return {
    mode: 'gemini',
    reply,
  }
}

function providerOrder() {
  if (aiProvider === 'openai') return ['openai', 'gemini']
  if (aiProvider === 'gemini') return ['gemini', 'openai']
  return ['openai', 'gemini']
}

export async function generateChatReply(message = '') {
  const cached = getCachedReply(message)
  if (cached) return { ...cached, cached: true }

  if (shouldUseFallbackOnly(message)) {
    const fallback = {
      mode: 'fallback',
      reply: buildFallbackReply(message),
    }
    setCachedReply(message, fallback)
    return fallback
  }

  for (const provider of providerOrder()) {
    try {
      const result = provider === 'openai' ? await callOpenAI(message) : await callGemini(message)
      setCachedReply(message, result)
      return result
    } catch {
      // try next provider
    }
  }

  const fallback = {
    mode: 'fallback',
    reply: buildFallbackReply(message),
  }
  setCachedReply(message, fallback)
  return fallback
}

export function getAiMeta() {
  return {
    strategy: aiProvider,
    configuredProviders: {
      openai: Boolean(openAiApiKey),
      gemini: Boolean(geminiApiKey),
    },
    models: {
      openai: openAiApiKey ? openAiModel : null,
      gemini: geminiApiKey ? geminiModel : null,
    },
    cache: {
      ttlMs: cacheTtlMs,
      maxEntries: maxCacheEntries,
      size: replyCache.size,
    },
  }
}
