const auditEntries = []
const maxEntries = 500

export function appendAuditEntry(entry) {
  auditEntries.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...entry,
  })

  if (auditEntries.length > maxEntries) {
    auditEntries.length = maxEntries
  }
}

export function listAuditEntries(limit = 50) {
  return auditEntries.slice(0, Math.max(1, Math.min(limit, 200)))
}
