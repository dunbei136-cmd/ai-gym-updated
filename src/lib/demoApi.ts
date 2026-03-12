import { seedBookingRecords, storageKey } from '../data/content'
import type { BookingDetailPatch, BookingRecord, GymApi, LeadForm, LeadSource, LeadStage } from '../types'

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

function buildAssistantReply(message: string) {
  const normalized = message.trim().toLowerCase()

  if (normalized.includes('會員')) {
    return '目前會先推薦體驗課、月會籍、一對一教練課三種路徑；若你還沒上過，建議先從體驗課開始。'
  }

  if (normalized.includes('新手') || normalized.includes('推薦') || normalized.includes('課')) {
    return '如果你是新手，我會優先推薦「新手燃脂體驗課」或「體態評估 + 教練諮詢」，先確認目標再安排適合的教練。'
  }

  if (normalized.includes('查詢') || normalized.includes('預約') || normalized.includes('booking')) {
    return '可以，你可以直接到 Booking Lookup 輸入手機號碼與 Email，查詢預設 demo 或剛建立的新預約。'
  }

  return '我是健身房 AI 接待助理，目前可協助 FAQ、方案介紹、體驗課導流與預約查詢。'
}

export const demoApi: GymApi = {
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
    const updated: BookingRecord = normalizeBooking(
      existing
        ? {
            ...existing,
            status,
            stage:
              existing.stage === '流失' || existing.stage === '已成交'
                ? existing.stage
                : resolveStageFromStatus(status),
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

    const now = new Date().toISOString()
    const updated: BookingRecord = normalizeBooking(
      existing
        ? { ...existing, ...patch, updatedAt: now }
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
            activityLog: patch.activityLog ?? [],
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
