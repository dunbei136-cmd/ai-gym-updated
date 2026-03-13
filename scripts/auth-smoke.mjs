const baseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:8788'

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const data = await response.json().catch(() => null)
  return { response, data }
}

async function main() {
  const suffix = `${Date.now()}`.slice(-8)
  const phone = `09${suffix}`.slice(0, 10)
  const email = `auth-smoke-${suffix}@example.com`

  const create = await request('/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Auth Smoke',
      phone,
      email,
      goal: '減脂 / 新手入門',
      preferredSlot: '平日晚上',
    }),
  })

  const unauthorized = await request('/bookings/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      email,
      status: '已確認',
    }),
  })

  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'pulsefit-demo' }),
  })

  const token = login.data?.token || ''
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  const session = await request('/auth/session', { headers: authHeaders })

  const authorized = await request('/bookings/status', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      phone,
      email,
      status: '已確認',
    }),
  })

  const logout = await request('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  const sessionAfterLogout = await request('/auth/session', { headers: authHeaders })

  console.log(
    JSON.stringify(
      {
        baseUrl,
        createdStatus: create.response.status,
        createdBooking: create.data?.name ?? null,
        unauthorizedStatus: unauthorized.response.status,
        loginStatus: login.response.status,
        loginOk: login.data?.ok ?? false,
        sessionUser: session.data?.session?.username ?? null,
        authorizedStatus: authorized.response.status,
        updatedBookingStatus: authorized.data?.status ?? null,
        logoutStatus: logout.response.status,
        sessionAfterLogout: sessionAfterLogout.data?.session ?? null,
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
