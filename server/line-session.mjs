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
