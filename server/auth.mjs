import crypto from 'node:crypto'

const sessions = new Map()
const adminUsername = process.env.ADMIN_USERNAME || 'admin'
const adminPassword = process.env.ADMIN_PASSWORD || 'pulsefit-demo'
const tokenTtlMs = Number(process.env.ADMIN_SESSION_TTL_MS || 1000 * 60 * 60 * 12)

function parseBearerToken(req) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) return ''
  return header.slice('Bearer '.length).trim()
}

export function createSession(username) {
  const token = crypto.randomBytes(24).toString('hex')
  const session = {
    username,
    expiresAt: Date.now() + tokenTtlMs,
  }
  sessions.set(token, session)
  return { token, session: { username } }
}

export function authenticateAdmin(username, password) {
  if (username !== adminUsername || password !== adminPassword) return null
  return createSession(username)
}

export function getSessionFromRequest(req) {
  const token = parseBearerToken(req)
  if (!token) return null
  const session = sessions.get(token)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    sessions.delete(token)
    return null
  }
  return { token, session: { username: session.username } }
}

export function clearSessionFromRequest(req) {
  const token = parseBearerToken(req)
  if (!token) return false
  return sessions.delete(token)
}

export function requireSession(req) {
  return getSessionFromRequest(req)?.session ?? null
}
