import { demoApi } from './demoApi'
import type { AuthCredentials, GymApi } from '../types'

const mode = import.meta.env.VITE_API_MODE ?? 'demo'
const baseUrl = import.meta.env.VITE_API_BASE_URL
const authStorageKey = 'pulsefit-admin-token'

function readAuthToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(authStorageKey) ?? ''
}

function writeAuthToken(token: string) {
  if (typeof window === 'undefined') return
  if (!token) {
    window.localStorage.removeItem(authStorageKey)
    return
  }
  window.localStorage.setItem(authStorageKey, token)
}

function createHttpApi(): GymApi {
  const fetchJson = async (path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const token = readAuthToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const errorMessage =
        data?.error?.message ??
        data?.error ??
        data?.message ??
        `Request failed: ${response.status}`
      throw new Error(errorMessage)
    }
    return data
  }

  return {
    async getSession() {
      try {
        const data = await fetchJson('/auth/session')
        return data.session ?? null
      } catch {
        writeAuthToken('')
        return null
      }
    },

    async login(credentials: AuthCredentials) {
      const data = await fetchJson('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      writeAuthToken(data.token ?? '')
      return data.session
    },

    async logout() {
      try {
        await fetchJson('/auth/logout', { method: 'POST' })
      } finally {
        writeAuthToken('')
      }
    },

    async listBookings() {
      return fetchJson('/bookings')
    },

    async createBooking(payload) {
      return fetchJson('/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    },

    async lookupBooking(phone, email) {
      const query = new URLSearchParams({ phone, email })
      const response = await fetch(`${baseUrl}/bookings/lookup?${query.toString()}`)
      if (response.status === 404) return null
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error?.message ?? data?.error ?? data?.message ?? `Request failed: ${response.status}`)
      }
      return data
    },

    async updateBookingStatus(phone, email, status) {
      return fetchJson('/bookings/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email, status }),
      })
    },

    async updateBookingDetails(phone, email, patch) {
      return fetchJson('/bookings/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email, ...patch }),
      })
    },

    async deleteBooking(phone, email) {
      await fetchJson('/bookings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email }),
      })
    },

    async sendChat(message) {
      const data = await fetchJson('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      return data.reply as string
    },
  }
}

export const api: GymApi = mode === 'http' && baseUrl ? createHttpApi() : demoApi
export const apiModeLabel = mode === 'http' && baseUrl ? 'HTTP API' : 'Demo API'
