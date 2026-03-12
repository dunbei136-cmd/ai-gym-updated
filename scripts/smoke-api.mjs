const baseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:8787'

async function main() {
  const health = await fetch(`${baseUrl}/health`).then((res) => res.json())
  const bookings = await fetch(`${baseUrl}/bookings`).then((res) => res.json())

  const create = await fetch(`${baseUrl}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Smoke Test',
      phone: '0900111222',
      email: 'smoke@example.com',
      goal: '減脂 / 新手入門',
      preferredSlot: '平日晚上',
    }),
  }).then((res) => res.json())

  const statusUpdate = await fetch(`${baseUrl}/bookings/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '0900111222',
      email: 'smoke@example.com',
      status: '已確認',
    }),
  }).then((res) => res.json())

  const detailUpdate = await fetch(`${baseUrl}/bookings/details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '0900111222',
      email: 'smoke@example.com',
      name: 'Smoke Test',
      className: '新手燃脂體驗課',
      trainer: 'Coach Aiden',
      date: '2026/03/22 18:00',
      notes: '測試自動 activity log',
      stage: '已聯繫',
      source: '網站表單',
      assignee: 'QA Bot',
      nextFollowUpAt: '2026-03-22T09:00',
      activityLog: statusUpdate.activityLog ?? [],
    }),
  }).then((res) => res.json())

  const lookup = await fetch(
    `${baseUrl}/bookings/lookup?phone=0900111222&email=smoke@example.com`,
  ).then((res) => res.json())

  const chat = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '我想了解會員方案' }),
  }).then((res) => res.json())

  console.log(
    JSON.stringify(
      {
        health,
        bookingCount: bookings.length,
        created: create.name,
        statusUpdatedTo: statusUpdate.status,
        detailUpdatedStage: detailUpdate.stage,
        detailUpdatedAssignee: detailUpdate.assignee,
        lookupStatus: lookup.status,
        activityLogCount: Array.isArray(lookup.activityLog) ? lookup.activityLog.length : 0,
        activityLogPreview: Array.isArray(lookup.activityLog) ? lookup.activityLog.slice(0, 4) : [],
        chatMode: chat.mode,
        chatReply: chat.reply,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
