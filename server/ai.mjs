const aiProvider = process.env.AI_PROVIDER || 'auto'

const openAiApiKey = process.env.OPENAI_API_KEY
const openAiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const openAiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini'

const geminiApiKey = process.env.GEMINI_API_KEY
const geminiBaseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

const systemPrompt = `
You are PulseFit AI, a gym concierge assistant for a Mandarin-speaking audience.
Reply in Traditional Chinese.
Sound natural, warm, and practical like a human receptionist.
Keep replies concise, usually 2-4 short sentences.
If the user is greeting you, checking whether you're there, or making small talk, respond naturally first instead of pushing booking.
If the intent is unclear, give a low-pressure prompt and do not repeat the exact same CTA every time.
Help users understand memberships, trial classes, schedules, parking, and booking lookup steps.
If the user asks about booking lookup, remind them to use phone + email.
Avoid robotic repetition and avoid sounding like a scripted customer service bot.
`.trim()

const replyCache = new Map()
const cacheTtlMs = Number(process.env.AI_CACHE_TTL_MS || 10 * 60 * 1000)
const maxCacheEntries = Number(process.env.AI_CACHE_MAX || 200)
let lastReplyFingerprint = ''
let lastReplyText = ''

function normalizeMessage(message = '') {
  return message.trim().replace(/\s+/g, ' ').slice(0, 500).toLowerCase()
}

function normalizeReply(reply = '') {
  return reply.trim().replace(/\s+/g, ' ')
}

function chooseVariant(message = '', variants = []) {
  if (!variants.length) return ''
  const seed = [...normalizeMessage(message)].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return variants[seed % variants.length]
}

function detectIntent(message = '') {
  const normalized = normalizeMessage(message)

  if (!normalized) return 'empty'

  if (/^(hi|hello|hey|哈囉|哈罗|你好|嗨|安安|在嗎|在吗|有人嗎|有人吗)$/.test(normalized)) {
    return 'greeting'
  }

  if (
    normalized.includes('你在幹嘛') ||
    normalized.includes('你在干嘛') ||
    normalized.includes('你在做什麼') ||
    normalized.includes('你在做什么') ||
    normalized.includes('忙嗎') ||
    normalized.includes('忙吗') ||
    normalized.includes('你是誰') ||
    normalized.includes('你是谁')
  ) {
    return 'smalltalk'
  }

  if (normalized.includes('停車') || normalized.includes('停车')) return 'parking'
  if (normalized.includes('查詢') || normalized.includes('查一下') || normalized.includes('booking')) return 'lookup'
  if (normalized.includes('預約') || normalized.includes('预约')) return 'booking'
  if (normalized.includes('價格') || normalized.includes('价') || normalized.includes('費用') || normalized.includes('费用') || normalized.includes('多少錢') || normalized.includes('多少钱')) return 'pricing'
  if (normalized.includes('會員') || normalized.includes('会籍')) return 'membership'
  if (normalized.includes('新手') || normalized.includes('推薦') || normalized.includes('推荐')) return 'beginner'
  if (normalized.includes('教練') || normalized.includes('教练')) return 'coach'
  if (normalized.includes('時間') || normalized.includes('营业') || normalized.includes('營業')) return 'time'
  if (normalized.includes('高手') || normalized.includes('進階') || normalized.includes('进阶') || normalized.includes('重訓經驗') || normalized.includes('有在練')) return 'experienced'
  if (normalized.includes('課') || normalized.includes('课程')) return 'course'

  return 'unknown'
}

export function buildFallbackReply(message = '') {
  const intent = detectIntent(message)

  switch (intent) {
    case 'greeting':
      return chooseVariant(message, [
        '哈囉，我在。你想先了解課程、價格，還是直接看可約時間？',
        '嗨，我在這邊。你可以直接跟我說想問課程、費用，或是想安排體驗。',
        '你好，我在。你今天是想先問問看，還是已經想直接約時間？',
      ])
    case 'smalltalk':
      return chooseVariant(message, [
        '我在啊，等你丟問題給我 😄 你想了解課程、價格，還是直接預約？',
        '在，沒有消失。你想先聊方案、費用，還是看時間？',
        '我在，隨時可以接你。你今天是想先了解一下，還是有想直接安排？',
      ])
    case 'parking':
      return '有，附近有合作停車場跟路邊停車格；如果你是第一次來，我會建議提早 10 分鐘到，找車位跟報到都比較從容。'
    case 'pricing':
      return chooseVariant(message, [
        '目前可先看三種主路徑：體驗課、月會籍、私人教練方案；如果你是第一次接觸，通常會建議先從體驗課開始。',
        '費用會依體驗課、月會籍、一對一教練課而不同；如果你願意說一下目標，我可以先幫你縮小到比較適合的方案。',
      ])
    case 'membership':
      return '目前會先推薦體驗課、月會籍、一對一教練課三種路徑；如果你還沒上過，建議先從體驗課開始，再決定是否升級。'
    case 'beginner':
      return '如果你是新手，我會優先推薦「新手燃脂體驗課」或「體態評估 + 教練諮詢」，先確認目標再安排適合的教練。'
    case 'experienced':
      return '如果你已經有訓練底子，我會比較偏向幫你看目前卡在哪一塊，再安排增肌訓練諮詢或更進階的一對一教練課。'
    case 'coach':
      return '目前可依目標安排不同教練，例如燃脂、新手入門、增肌重訓、體態矯正；如果你告訴我目標，我可以先幫你分流。'
    case 'time':
      return '你可以先告訴我偏好的時段，例如平日白天、平日晚上、週末上午；目前 demo 會依時段自動安排可預約時間。'
    case 'lookup':
      return '可以，請提供手機號碼與 Email，或直接使用 Booking Lookup 頁面查詢預約。'
    case 'booking':
      return chooseVariant(message, [
        '可以，我幫你接。你直接告訴我想約什麼課，或到下方表單留下姓名、手機與 Email 也可以。',
        '沒問題，想預約的話你可以直接留姓名、手機、Email 和偏好時段，我幫你往下安排。',
      ])
    case 'course':
      return '如果你告訴我是想減脂、增肌、體態調整，還是先體驗看看，我可以直接幫你縮小到最適合的一堂課。'
    default:
      return chooseVariant(message, [
        '我在，你可以直接跟我說你現在最想問哪一塊，我幫你整理。',
        '沒事，你先說你想了解課程、價格，還是時段，我幫你接下去。',
        '可以，你直接丟問題給我，不用一次講很完整也沒關係。',
      ])
  }
}

function shouldUseFallbackOnly(message = '') {
  const intent = detectIntent(message)
  if (intent === 'empty') return true

  return [
    'greeting',
    'smalltalk',
    'parking',
    'pricing',
    'membership',
    'beginner',
    'experienced',
    'coach',
    'time',
    'lookup',
    'booking',
    'course',
  ].includes(intent)
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

function antiRepeatReply(message = '', reply = '') {
  const normalizedReply = normalizeReply(reply)
  if (!normalizedReply) return reply

  const fingerprint = `${detectIntent(message)}::${normalizedReply}`
  if (fingerprint !== lastReplyFingerprint) {
    lastReplyFingerprint = fingerprint
    lastReplyText = normalizedReply
    return reply
  }

  const fallbackVariant = buildFallbackReply(`${message} ${Date.now()}`)
  const normalizedFallback = normalizeReply(fallbackVariant)
  if (normalizedFallback && normalizedFallback !== lastReplyText) {
    lastReplyFingerprint = `${detectIntent(message)}::${normalizedFallback}`
    lastReplyText = normalizedFallback
    return fallbackVariant
  }

  const softened = `${normalizedReply} 如果你願意，也可以直接說你的目標，我幫你往下接。`
  lastReplyFingerprint = `${detectIntent(message)}::${softened}`
  lastReplyText = softened
  return softened
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
      temperature: 0.5,
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
          temperature: 0.5,
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
  if (cached) {
    return { ...cached, reply: antiRepeatReply(message, cached.reply), cached: true }
  }

  if (shouldUseFallbackOnly(message)) {
    const fallback = {
      mode: 'fallback',
      reply: antiRepeatReply(message, buildFallbackReply(message)),
    }
    setCachedReply(message, fallback)
    return fallback
  }

  for (const provider of providerOrder()) {
    try {
      const result = provider === 'openai' ? await callOpenAI(message) : await callGemini(message)
      const safeResult = {
        ...result,
        reply: antiRepeatReply(message, result.reply),
      }
      setCachedReply(message, safeResult)
      return safeResult
    } catch {
      // try next provider
    }
  }

  const fallback = {
    mode: 'fallback',
    reply: antiRepeatReply(message, buildFallbackReply(message)),
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
