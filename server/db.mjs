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
  },
  {
    name: '陳志豪',
    phone: '0987654321',
    email: 'leo.demo@example.com',
    className: '增肌訓練諮詢',
    trainer: 'Coach Vera',
    date: '2026/03/19 14:30',
    status: '待回覆',
  },
  {
    name: '林佩琪',
    phone: '0955667788',
    email: 'peggy.demo@example.com',
    className: '團體核心課',
    trainer: 'Coach Max',
    date: '2026/03/12 20:00',
    status: '已完成',
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
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone, email)
  );
`)

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
    INSERT OR IGNORE INTO bookings (name, phone, email, className, trainer, date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  db.exec('BEGIN')
  try {
    for (const row of initialData) {
      insert.run(row.name, row.phone, row.email, row.className, row.trainer, row.date, row.status)
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
    SELECT name, phone, email, className, trainer, date, status
    FROM bookings
    ORDER BY datetime(createdAt) DESC, id DESC
  `).all()

  return rows.map(normalizeRow)
}

export function lookupBooking(phone, email) {
  const row = db.prepare(`
    SELECT name, phone, email, className, trainer, date, status
    FROM bookings
    WHERE phone = ? AND lower(email) = lower(?)
    LIMIT 1
  `).get(phone.trim(), email.trim())

  return normalizeRow(row)
}

export function upsertBooking(booking) {
  db.prepare(`
    INSERT INTO bookings (name, phone, email, className, trainer, date, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(phone, email) DO UPDATE SET
      name = excluded.name,
      className = excluded.className,
      trainer = excluded.trainer,
      date = excluded.date,
      status = excluded.status,
      updatedAt = CURRENT_TIMESTAMP
  `).run(
    booking.name,
    booking.phone,
    booking.email.toLowerCase(),
    booking.className,
    booking.trainer,
    booking.date,
    booking.status,
  )

  return lookupBooking(booking.phone, booking.email)
}

export function updateBookingStatus(phone, email, status) {
  db.prepare(`
    UPDATE bookings
    SET status = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE phone = ? AND lower(email) = lower(?)
  `).run(status, phone.trim(), email.trim().toLowerCase())

  return lookupBooking(phone, email)
}

export function updateBookingDetails(phone, email, patch) {
  db.prepare(`
    UPDATE bookings
    SET className = ?, trainer = ?, date = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE phone = ? AND lower(email) = lower(?)
  `).run(
    patch.className,
    patch.trainer,
    patch.date,
    phone.trim(),
    email.trim().toLowerCase(),
  )

  return lookupBooking(phone, email)
}

export function getDbMeta() {
  const row = db.prepare('SELECT COUNT(*) AS count FROM bookings').get()
  return {
    driver: 'sqlite',
    path: dbPath,
    bookings: row.count,
  }
}
