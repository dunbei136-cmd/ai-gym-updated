const lineSessions = new Map()

export function getLineSession(userId) {
  return lineSessions.get(userId) || null
}

export function upsertLineSession(userId, patch) {
  const current = lineSessions.get(userId) || {
    userId,
    step: 'idle',
    form: {},
    updatedAt: new Date().toISOString(),
  }

  const next = {
    ...current,
    ...patch,
    form: {
      ...current.form,
      ...(patch.form || {}),
    },
    updatedAt: new Date().toISOString(),
  }

  lineSessions.set(userId, next)
  return next
}

export function resetLineSession(userId) {
  lineSessions.delete(userId)
}

export function normalizeLineGoal(text) {
  if (text.includes('增肌') || text.includes('重訓')) return '增肌 / 重訓規劃'
  if (text.includes('體態') || text.includes('姿勢')) return '姿勢矯正 / 體態改善'
  if (text.includes('團課') || text.includes('參觀')) return '團體課 / 體驗參觀'
  return '減脂 / 新手入門'
}

export function normalizeLineSlot(text) {
  if (text.includes('白天') || text.includes('平日白天')) return '平日白天'
  if (text.includes('週末') || text.includes('假日')) return '週末上午'
  return '平日晚上'
}

export function isLikelyPhone(text) {
  return /^0\d{8,10}$/.test(text.replace(/[^\d]/g, ''))
}

export function sanitizePhone(text) {
  return text.replace(/[^\d]/g, '')
}

export function isLikelyEmail(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())
}
