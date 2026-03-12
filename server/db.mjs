import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, 'data')
const dbPath = path.join(dataDir, 'pulsefit.db')
const legacyJsonPath = path.join(dataDir, 'bookings.json')

const seedBookings = [
  {
    name: '王小美',
    phone: '0912345678',
    email: 'amy.demo@example.com',
    className: '新手燃脂體驗課',
    trainer: 'Coach Aiden',
    date: '2026/03/18 19:00',
    status: '已確認',
    stage: '已預約體驗',
    source: '網站表單',
    assignee: 'Nina',
    nextFollowUpAt: '2026-03-17T10:00',
    notes: '已完成初步體驗課確認，可追蹤轉正式會員。',
  },
  {
    name: '陳志豪',
    phone: '0987654321',
    email: 'leo.demo@example.com',
    className: '增肌訓練諮詢',
    trainer: 'Coach Vera',
    date: '2026/03/19 14:30',
    status: '待回覆',
    stage: '已聯繫',
    source: 'AI 聊天',
    assignee: 'Mason',
    nextFollowUpAt: '2026-03-13T11:00',
    notes: '偏好下午時段，對重訓課表很有興趣。',
  },
  {
    name: '林佩琪',
    phone: '0955667788',
    email: 'peggy.demo@example.com',
    className: '團體核心課',
    trainer: 'Coach Max',
    date: '2026/03/12 20:00',
    status: '已完成',
    stage: '已成交',
    source: 'LINE',
    assignee: 'Nina',
    nextFollowUpAt: '',
    notes: '已完成體驗，可作為回訪名單。',
  },
]

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new DatabaseSync(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    className TEXT NOT NULL,
    trainer TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL DEFAULT '新名單',
    source TEXT NOT NULL DEFAULT '網站表單',
    assignee TEXT NOT NULL DEFAULT '未指派',
    nextFollowUpAt TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone, email)
  );
`)

const columns = db.prepare(`PRAGMA table_info(bookings)`).all()

function ensureColumn(name, definition) {
  if (!columns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE bookings ADD COLUMN ${name} ${definition}`)
  }
}

ensureColumn('notes', `TEXT NOT NULL DEFAULT ''`)
ensureColumn('stage', `TEXT NOT NULL DEFAULT '新名單'`)
ensureColumn('source', `TEXT NOT NULL DEFAULT '網站表單'`)
ensureColumn('assignee', `TEXT NOT NULL DEFAULT '未指派'`)
ensureColumn('nextFollowUpAt', `TEXT NOT NULL DEFAULT ''`)

function resolveStageFromStatus(status) {
  if (status === '已完成') return '已成交'
  if (status === '已確認') return '已預約體驗'
  return '新名單'
}

function normalizeRow(row) {
  if (!row) return null
  return {
    name: row.name,
    phone: row.phone,
    email: row.email,
    className: row.className,
    trainer: row.trainer,
    date: row.date,
    status: row.status,
    notes: row.notes ?? '',
    stage: row.stage || resolveStageFromStatus(row.status),
    source: row.source || '網站表單',
    assignee: row.assignee || '未指派',
    nextFollowUpAt: row.nextFollowUpAt ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count
  if (count > 0) return

  let initialData = seedBookings

  if (fs.existsSync(legacyJsonPath)) {
    try {
      const raw = fs.readFileSync(legacyJsonPath, 'utf8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        initialData = parsed
      }
    } catch {
      // ignore legacy seed read failure and keep default seeds
    }
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO bookings (
      name, phone, email, className, trainer, date, status, notes, stage, source, assignee, nextFollowUpAt, createdAt, updatedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `)

  db.exec('BEGIN')
  try {
    for (const row of initialData) {
      insert.run(
        row.name,
        row.phone,
        row.email,
        row.className,
        row.trainer,
        row.date,
        row.status,
        row.notes ?? '',
        row.stage ?? resolveStageFromStatus(row.status),
        row.source ?? '網站表單',
        row.assignee ?? '未指派',
        row.nextFollowUpAt ?? '',
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

seedIfEmpty()

export function listBookings() {
  const rows = db.prepare(`
    SELECT name, phone, email, className, trainer, date, status, notes, stage, source, assignee, nextFollowUpAt, createdAt, updatedAt
    FROM bookings
    ORDER BY datetime(updatedAt) DESC, id DESC
  `).all()

  return rows.map(normalizeRow)
}

export function lookupBooking(phone, email) {
  const row = db.prepare(`
    SELECT name, phone, email, className, trainer, date, status, notes, stage, source, assignee, nextFollowUpAt, createdAt, updatedAt
    FROM bookings
    WHERE phone = ? AND lower(email) = lower(?)
    LIMIT 1
  `).get(phone.trim(), email.trim())

  return normalizeRow(row)
}

export function upsertBooking(booking) {
  db.prepare(`
    INSERT INTO bookings (
      name, phone, email, className, trainer, date, status, notes, stage, source, assignee, nextFollowUpAt, createdAt, updatedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(phone, email) DO UPDATE SET
      name = excluded.name,
      className = excluded.className,
      trainer = excluded.trainer,
      date = excluded.date,
      status = excluded.status,
      notes = excluded.notes,
      stage = excluded.stage,
      source = excluded.source,
      assignee = excluded.assignee,
      nextFollowUpAt = excluded.nextFollowUpAt,
      updatedAt = CURRENT_TIMESTAMP
  `).run(
    booking.name,
    booking.phone,
    booking.email.toLowerCase(),
    booking.className,
    booking.trainer,
    booking.date,
    booking.status,
    booking.notes ?? '',
    booking.stage ?? resolveStageFromStatus(booking.status),
    booking.source ?? '網站表單',
    booking.assignee ?? '未指派',
    booking.nextFollowUpAt ?? '',
  )

  return lookupBooking(booking.phone, booking.email)
}

export function updateBookingStatus(phone, email, status) {
  const existing = lookupBooking(phone, email)
  if (!existing) return null

  const nextStage =
    existing.stage === '流失' || existing.stage === '已成交'
      ? existing.stage
      : resolveStageFromStatus(status)

  db.prepare(`
    UPDATE bookings
    SET status = ?, stage = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE phone = ? AND lower(email) = lower(?)
  `).run(status, nextStage, phone.trim(), email.trim().toLowerCase())

  return lookupBooking(phone, email)
}

export function updateBookingDetails(phone, email, patch) {
  db.prepare(`
    UPDATE bookings
    SET name = ?, className = ?, trainer = ?, date = ?, notes = ?, stage = ?, source = ?, assignee = ?, nextFollowUpAt = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE phone = ? AND lower(email) = lower(?)
  `).run(
    patch.name,
    patch.className,
    patch.trainer,
    patch.date,
    patch.notes ?? '',
    patch.stage ?? '新名單',
    patch.source ?? '網站表單',
    patch.assignee ?? '未指派',
    patch.nextFollowUpAt ?? '',
    phone.trim(),
    email.trim().toLowerCase(),
  )

  return lookupBooking(phone, email)
}

export function deleteBooking(phone, email) {
  const normalizedPhone = phone.trim()
  const normalizedEmail = email.trim().toLowerCase()
  const existing = lookupBooking(normalizedPhone, normalizedEmail)
  if (!existing) return false

  db.prepare(`
    DELETE FROM bookings
    WHERE phone = ? AND lower(email) = lower(?)
  `).run(normalizedPhone, normalizedEmail)

  return true
}

export function getDbMeta() {
  const row = db.prepare('SELECT COUNT(*) AS count FROM bookings').get()
  return {
    driver: 'sqlite',
    path: dbPath,
    bookings: row.count,
  }
}
