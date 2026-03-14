import { seedBookingRecords, storageKey } from '../data/content'
import type { AuthCredentials, AuthSession, BookingDetailPatch, BookingRecord, GymApi, HealthSnapshot, LeadForm, LeadSource, LeadStage } from '../types'

const authStorageKey = `${storageKey}-auth-session`
let lastDemoReply = ''

function readDemoSession(): AuthSession | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(authStorageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed.username === 'string' ? { username: parsed.username } : null
  } catch {
    return null
  }
}

function writeDemoSession(session: AuthSession | null) {
  if (typeof window === 'undefined') return
  if (!session) {
    window.localStorage.removeItem(authStorageKey)
    return
  }
  window.localStorage.setItem(authStorageKey, JSON.stringify(session))
}

function readStoredBookings() {
  if (typeof window === 'undefined') return [] as BookingRecord[]

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.map((item) => normalizeBooking(item))
      : []
  } catch {
    return []
  }
}

function writeStoredBookings(bookings: BookingRecord[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey, JSON.stringify(bookings))
}

function getBookingKey(phone: string, email: string) {
  return `${phone.trim()}::${email.trim().toLowerCase()}`
}

function readDeletedBookingKeys() {
  if (typeof window === 'undefined') return [] as string[]

  try {
    const raw = window.localStorage.getItem(`${storageKey}-deleted`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeDeletedBookingKeys(keys: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${storageKey}-deleted`, JSON.stringify(keys))
}

function listDemoBookings() {
  const deletedKeys = new Set(readDeletedBookingKeys())
  const stored = readStoredBookings()
  const storedKeys = new Set(stored.map((item) => getBookingKey(item.phone, item.email)))
  const filteredSeed = seedBookingRecords
    .filter((item) => {
      const key = getBookingKey(item.phone, item.email)
      return !deletedKeys.has(key) && !storedKeys.has(key)
    })
    .map((item) => normalizeBooking(item))

  return [...stored, ...filteredSeed]
}

function resolveProgram(goal: string) {
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

function resolveSlot(preferredSlot: string) {
  if (preferredSlot === '平日白天') return '2026/03/20 14:00'
  if (preferredSlot === '週末上午') return '2026/03/21 11:00'
  return '2026/03/20 19:30'
}

function resolveStageFromStatus(status: BookingRecord['status']): LeadStage {
  if (status === '已完成') return '已成交'
  if (status === '已確認') return '已預約體驗'
  return '新名單'
}

function normalizeStage(value: unknown, status: BookingRecord['status']): LeadStage {
  if (value === '新名單' || value === '已聯繫' || value === '已預約體驗' || value === '已成交' || value === '流失') {
    return value
  }
  return resolveStageFromStatus(status)
}

function normalizeSource(value: unknown): LeadSource {
  if (value === '網站表單' || value === 'AI 聊天' || value === 'LINE' || value === '電話' || value === 'Walk-in') {
    return value
  }
  return '網站表單'
}

function normalizeBooking(item: Partial<BookingRecord> & Record<string, unknown>): BookingRecord {
  const status = item.status === '已確認' || item.status === '已完成' ? item.status : '待回覆'
  return {
    name: typeof item.name === 'string' ? item.name : '',
    phone: typeof item.phone === 'string' ? item.phone : '',
    email: typeof item.email === 'string' ? item.email.toLowerCase() : '',
    className: typeof item.className === 'string' ? item.className : '',
    trainer: typeof item.trainer === 'string' ? item.trainer : '',
    date: typeof item.date === 'string' ? item.date : '',
    status,
    notes: typeof item.notes === 'string' ? item.notes : '',
    stage: normalizeStage(item.stage, status),
    source: normalizeSource(item.source),
    assignee: typeof item.assignee === 'string' ? item.assignee : '未指派',
    nextFollowUpAt: typeof item.nextFollowUpAt === 'string' ? item.nextFollowUpAt : '',
    activityLog: Array.isArray(item.activityLog)
      ? item.activityLog.filter((entry): entry is string => typeof entry === 'string')
      : [],
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
  }
}

function formatLogTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function prependActivityEntries(existing: string[], entries: string[]) {
  const normalizedExisting = Array.isArray(existing) ? existing : []
  const dedupedEntries = entries.filter((entry, index) => entry && entries.indexOf(entry) === index)
  return [...dedupedEntries, ...normalizedExisting.filter((entry) => !dedupedEntries.includes(entry))]
}

function buildDetailChangeEntries(existing: BookingRecord | undefined, patch: BookingDetailPatch, now: Date) {
  if (!existing) return Array.isArray(patch.activityLog) ? patch.activityLog : []

  const nextEntries: string[] = []
  const stamp = formatLogTimestamp(now)

  if (existing.stage !== patch.stage) {
    nextEntries.push(`${stamp} 名單階段改為 ${patch.stage}`)
  }

  if (existing.assignee !== patch.assignee) {
    nextEntries.push(`${stamp} 負責人改為 ${patch.assignee}`)
  }

  if (existing.nextFollowUpAt !== patch.nextFollowUpAt) {
    nextEntries.push(
      patch.nextFollowUpAt ? `${stamp} 設定下次追蹤 ${patch.nextFollowUpAt}` : `${stamp} 清除下次追蹤`,
    )
  }

  if (existing.date !== patch.date) {
    nextEntries.push(`${stamp} 調整預約時間為 ${patch.date}`)
  }

  if (existing.trainer !== patch.trainer) {
    nextEntries.push(`${stamp} 指派教練改為 ${patch.trainer}`)
  }

  if (existing.className !== patch.className) {
    nextEntries.push(`${stamp} 課程改為 ${patch.className}`)
  }

  if (existing.source !== patch.source) {
    nextEntries.push(`${stamp} 名單來源改為 ${patch.source}`)
  }

  const patchLog = Array.isArray(patch.activityLog) ? patch.activityLog : []
  return prependActivityEntries(patchLog, nextEntries)
}

function normalizeMessage(message: string) {
  return message.trim().replace(/\s+/g, ' ').toLowerCase()
}

function chooseVariant(message: string, variants: string[]) {
  const normalized = normalizeMessage(message)
  const seed = [...normalized].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return variants[seed % variants.length]
}

function detectChatIntent(message: string) {
  const normalized = normalizeMessage(message)

  if (!normalized) return 'empty'
  if (/^(hi|hello|hey|哈囉|哈罗|你好|嗨|安安|在嗎|在吗|有人嗎|有人吗)$/.test(normalized)) return 'greeting'
  if (
    normalized.includes('你在幹嘛') ||
    normalized.includes('你在干嘛') ||
    normalized.includes('你在做什麼') ||
    normalized.includes('你在做什么') ||
    normalized.includes('忙嗎') ||
    normalized.includes('忙吗') ||
    normalized.includes('你是誰') ||
    normalized.includes('你是谁')
  ) return 'smalltalk'
  if (normalized.includes('停車') || normalized.includes('停车')) return 'parking'
  if (normalized.includes('明天') && (normalized.includes('課') || normalized.includes('团课') || normalized.includes('課程'))) return 'tomorrow-course'
  if (normalized.includes('高手') || normalized.includes('進階') || normalized.includes('进阶') || normalized.includes('有重訓經驗') || normalized.includes('有在練')) return 'experienced'
  if (normalized.includes('會員') || normalized.includes('費用') || normalized.includes('价格') || normalized.includes('價格')) return 'pricing'
  if (normalized.includes('新手') || normalized.includes('推薦') || normalized.includes('推荐')) return 'beginner'
  if (normalized.includes('查詢') || normalized.includes('預約') || normalized.includes('booking')) return 'lookup'
  if (normalized.includes('課') || normalized.includes('课程')) return 'course'

  return 'fallback'
}

function antiRepeatReply(nextReply: string, alternatives: string[]) {
  if (nextReply !== lastDemoReply) {
    lastDemoReply = nextReply
    return nextReply
  }

  const alternative = alternatives.find((item) => item !== lastDemoReply)
  if (alternative) {
    lastDemoReply = alternative
    return alternative
  }

  const softened = `${nextReply} 你如果願意，也可以直接說你的目標，我幫你往下接。`
  lastDemoReply = softened
  return softened
}

function buildAssistantReply(message: string) {
  const intent = detectChatIntent(message)

  switch (intent) {
    case 'greeting': {
      const variants = [
        '哈囉，我在。你想先了解課程、價格，還是直接看可約時間？',
        '嗨，我在這邊。你可以直接跟我說想問課程、費用，或是想安排體驗。',
        '你好，我在。你今天是想先問問看，還是已經想直接約時間？',
      ]
      return antiRepeatReply(chooseVariant(message, variants), variants)
    }
    case 'smalltalk': {
      const variants = [
        '我在啊，等你丟問題給我 😄 你想了解課程、價格，還是直接預約？',
        '在，沒有消失。你想先聊方案、費用，還是看時間？',
        '我在，隨時可以接你。你今天是想先了解一下，還是有想直接安排？',
      ]
      return antiRepeatReply(chooseVariant(message, variants), variants)
    }
    case 'parking':
      return antiRepeatReply(
        '有，示意場館設定為附近有合作停車場與路邊停車格；如果你是第一次來，建議提早 10 分鐘到，找車位跟報到都比較從容。',
        ['有，附近有合作停車場跟路邊停車格；第一次來的話建議提早 10 分鐘到，會比較從容。'],
      )
    case 'tomorrow-course':
      return antiRepeatReply(
        '明天目前可安排的示意課程包含「新手燃脂體驗課」、「增肌訓練諮詢」與「團體課體驗」；如果你告訴我是想減脂、增肌，還是先體驗看看，我可以直接幫你縮小到最適合的一堂。',
        ['明天目前有幾種示意課程可以排；你如果告訴我目標，我可以直接幫你挑比較適合的一堂。'],
      )
    case 'experienced':
      return antiRepeatReply(
        '如果你已經有訓練底子，我會優先推薦「增肌訓練諮詢」或進階強度的一對一教練課，先看你的訓練年資、目前卡關點，再安排比較合適。',
        ['如果你不是新手，我們就直接講重點。你現在比較卡的是增肌、動作，還是訓練安排？'],
      )
    case 'pricing':
      return antiRepeatReply(
        '目前會先推薦體驗課、月會籍、一對一教練課三種路徑；如果你還沒上過，通常會建議先從體驗課開始。',
        ['費用會依體驗課、月會籍和一對一教練課而不同；如果你告訴我目標，我可以先幫你縮小方案。'],
      )
    case 'beginner':
      return antiRepeatReply(
        '如果你是新手，我會優先推薦「新手燃脂體驗課」或「體態評估 + 教練諮詢」，先確認目標再安排適合的教練。',
        ['新手也沒關係，我通常會先建議從體驗課或體態評估開始，比較不會有壓力。'],
      )
    case 'lookup':
      return antiRepeatReply(
        '可以，你可以直接到 Booking Lookup 輸入手機號碼與 Email，查詢預設 demo 或剛建立的新預約。',
        ['沒問題，想查預約的話用手機號碼加 Email 就可以查到了。'],
      )
    case 'course':
      return antiRepeatReply(
        '如果你告訴我是想減脂、增肌、體態調整，還是先體驗看看，我可以直接幫你縮小到最適合的一堂課。',
        ['可以，你先說一下目標，我幫你抓比較適合的課程方向。'],
      )
    default: {
      const variants = [
        '我是健身房 AI 接待助理，目前可協助 FAQ、方案介紹、停車資訊、課程建議、體驗課導流與預約查詢。',
        '我在，你可以直接跟我說想了解課程、價格、時段，或是想查預約，我幫你接下去。',
        '沒事，你直接丟問題給我就好；你想先看方案、費用，還是預約流程？',
      ]
      return antiRepeatReply(chooseVariant(message, variants), variants)
    }
  }
}

export const demoApi: GymApi = {
  async getHealth() {
    return {
      ok: true,
      service: 'pulsefit-demo-api',
      db: {
        driver: 'localStorage',
        path: 'browser://localStorage',
        bookings: listDemoBookings().length,
      },
      ai: {
        strategy: 'demo',
        configuredProviders: {
          openai: false,
          gemini: false,
        },
        models: {
          openai: null,
          gemini: null,
        },
        cache: {
          ttlMs: 0,
          maxEntries: 0,
          size: 0,
        },
      },
      line: {
        configured: false,
        hasChannelAccessToken: false,
        hasChannelSecret: false,
      },
      metrics: {
        chat: {
          total: 0,
          fallback: 0,
          openai: 0,
          gemini: 0,
          lastMessageAt: '',
          fallbackRate: 0,
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
      },
    } satisfies HealthSnapshot
  },

  async getSession() {
    return readDemoSession()
  },

  async login(credentials: AuthCredentials) {
    if (credentials.username.trim() !== 'admin' || credentials.password !== 'pulsefit-demo') {
      throw new Error('帳號或密碼錯誤')
    }

    const session = { username: 'admin' }
    writeDemoSession(session)
    return session
  },

  async logout() {
    writeDemoSession(null)
  },

  async listBookings() {
    return listDemoBookings()
  },

  async createBooking(payload: LeadForm) {
    const program = resolveProgram(payload.goal)

    const now = new Date().toISOString()
    const booking: BookingRecord = {
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      email: payload.email.trim().toLowerCase(),
      className: program.className,
      trainer: program.trainer,
      date: resolveSlot(payload.preferredSlot),
      status: '待回覆',
      notes: '',
      stage: '新名單',
      source: '網站表單',
      assignee: '未指派',
      nextFollowUpAt: '',
      activityLog: [`${now.slice(0, 16).replace('T', ' ')} 建立名單`],
      createdAt: now,
      updatedAt: now,
    }

    const next = [
      booking,
      ...readStoredBookings().filter(
        (item) => !(item.phone === booking.phone && item.email === booking.email),
      ),
    ]

    writeStoredBookings(next)

    const deletedKeys = new Set(readDeletedBookingKeys())
    deletedKeys.delete(getBookingKey(booking.phone, booking.email))
    writeDeletedBookingKeys([...deletedKeys])

    return booking
  },

  async lookupBooking(phone: string, email: string) {
    const normalizedPhone = phone.trim()
    const normalizedEmail = email.trim().toLowerCase()
    const records = listDemoBookings()

    return (
      records.find(
        (item) => item.phone === normalizedPhone && item.email.toLowerCase() === normalizedEmail,
      ) ?? null
    )
  },

  async updateBookingStatus(phone: string, email: string, status: BookingRecord['status']) {
    const normalizedPhone = phone.trim()
    const normalizedEmail = email.trim().toLowerCase()
    const stored = readStoredBookings()
    const existing =
      stored.find(
        (item) => item.phone === normalizedPhone && item.email.toLowerCase() === normalizedEmail,
      ) ??
      seedBookingRecords.find(
        (item) => item.phone === normalizedPhone && item.email.toLowerCase() === normalizedEmail,
      )

    const now = new Date().toISOString()
    const nextStage =
      existing && (existing.stage === '流失' || existing.stage === '已成交')
        ? existing.stage
        : resolveStageFromStatus(status)

    const updated: BookingRecord = normalizeBooking(
      existing
        ? {
            ...existing,
            status,
            stage: nextStage,
            activityLog: prependActivityEntries(existing.activityLog, [
              `${formatLogTimestamp(new Date(now))} 狀態改為 ${status}`,
              ...(existing.stage !== nextStage ? [`${formatLogTimestamp(new Date(now))} 名單階段改為 ${nextStage}`] : []),
            ]),
            updatedAt: now,
          }
        : {
            name: '',
            phone: normalizedPhone,
            email: normalizedEmail,
            className: '',
            trainer: '',
            date: '',
            status,
            notes: '',
            stage: resolveStageFromStatus(status),
            source: '網站表單',
            assignee: '未指派',
            nextFollowUpAt: '',
            activityLog: [],
            createdAt: now,
            updatedAt: now,
          },
    )

    const next = [
      updated,
      ...stored.filter(
        (item) => !(item.phone === normalizedPhone && item.email.toLowerCase() === normalizedEmail),
      ),
    ]

    writeStoredBookings(next)
    return updated
  },

  async updateBookingDetails(
    phone: string,
    email: string,
    patch: BookingDetailPatch,
  ) {
    const normalizedPhone = phone.trim()
    const normalizedEmail = email.trim().toLowerCase()
    const stored = readStoredBookings()
    const existing =
      stored.find(
        (item) => item.phone === normalizedPhone && item.email.toLowerCase() === normalizedEmail,
      ) ??
      seedBookingRecords.find(
        (item) => item.phone === normalizedPhone && item.email.toLowerCase() === normalizedEmail,
      )

    const now = new Date()
    const nowIso = now.toISOString()
    const updated: BookingRecord = normalizeBooking(
      existing
        ? {
            ...existing,
            ...patch,
            activityLog: buildDetailChangeEntries(existing, patch, now),
            updatedAt: nowIso,
          }
        : {
            name: patch.name,
            phone: normalizedPhone,
            email: normalizedEmail,
            className: patch.className,
            trainer: patch.trainer,
            date: patch.date,
            status: '待回覆',
            notes: patch.notes ?? '',
            stage: patch.stage,
            source: patch.source,
            assignee: patch.assignee,
            nextFollowUpAt: patch.nextFollowUpAt,
            activityLog: prependActivityEntries(patch.activityLog ?? [], [`${formatLogTimestamp(now)} 建立名單`]),
            createdAt: nowIso,
            updatedAt: nowIso,
          },
    )

    const next = [
      updated,
      ...stored.filter(
        (item) => !(item.phone === normalizedPhone && item.email.toLowerCase() === normalizedEmail),
      ),
    ]

    writeStoredBookings(next)
    return updated
  },

  async deleteBooking(phone: string, email: string) {
    const normalizedPhone = phone.trim()
    const normalizedEmail = email.trim().toLowerCase()
    const next = readStoredBookings().filter(
      (item) => !(item.phone === normalizedPhone && item.email.toLowerCase() === normalizedEmail),
    )

    writeStoredBookings(next)

    const bookingKey = getBookingKey(normalizedPhone, normalizedEmail)
    const deletedKeys = new Set(readDeletedBookingKeys())
    deletedKeys.add(bookingKey)
    writeDeletedBookingKeys([...deletedKeys])
  },

  async sendChat(message: string) {
    return buildAssistantReply(message)
  },
}
