import { demoApi } from './demoApi'
import type { GymApi } from '../types'

const mode = import.meta.env.VITE_API_MODE ?? 'demo'
const baseUrl = import.meta.env.VITE_API_BASE_URL

function createHttpApi(): GymApi {
  return {
    async listBookings() {
      const response = await fetch(`${baseUrl}/bookings`)
      if (!response.ok) throw new Error('Failed to list bookings')
      return response.json()
    },

    async createBooking(payload) {
      const response = await fetch(`${baseUrl}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('Failed to create booking')
      return response.json()
    },

    async lookupBooking(phone, email) {
      const query = new URLSearchParams({ phone, email })
      const response = await fetch(`${baseUrl}/bookings/lookup?${query.toString()}`)
      if (response.status === 404) return null
      if (!response.ok) throw new Error('Failed to lookup booking')
      return response.json()
    },

    async updateBookingStatus(phone, email, status) {
      const response = await fetch(`${baseUrl}/bookings/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email, status }),
      })
      if (!response.ok) throw new Error('Failed to update booking status')
      return response.json()
    },

    async updateBookingDetails(phone, email, patch) {
      const response = await fetch(`${baseUrl}/bookings/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email, ...patch }),
      })
      if (!response.ok) throw new Error('Failed to update booking details')
      return response.json()
    },

    async deleteBooking(phone, email) {
      const response = await fetch(`${baseUrl}/bookings`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email }),
      })
      if (!response.ok) throw new Error('Failed to delete booking')
    },

    async sendChat(message) {
      const response = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!response.ok) throw new Error('Failed to send chat message')
      const data = await response.json()
      return data.reply as string
    },
  }
}

export const api: GymApi = mode === 'http' && baseUrl ? createHttpApi() : demoApi
export const apiModeLabel = mode === 'http' && baseUrl ? 'HTTP API' : 'Demo API'
