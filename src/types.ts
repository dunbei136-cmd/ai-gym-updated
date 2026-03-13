export type FAQItem = {
  question: string
  answer: string
}

export type BookingRecord = {
  name: string
  phone: string
  email: string
  className: string
  trainer: string
  date: string
  status: '已確認' | '待回覆' | '已完成'
}

export type ChatMessage = {
  role: 'assistant' | 'user'
  content: string
}

export type BookingDetailPatch = Pick<BookingRecord, 'className' | 'trainer' | 'date'>

export type Plan = {
  name: string
  price: string
  highlight?: boolean
  description: string
  features: string[]
}

export type LeadForm = {
  name: string
  phone: string
  email: string
  goal: string
  preferredSlot: string
}

export type Testimonial = {
  name: string
  quote: string
}

export type GymApi = {
  listBookings: () => Promise<BookingRecord[]>
  createBooking: (payload: LeadForm) => Promise<BookingRecord>
  lookupBooking: (phone: string, email: string) => Promise<BookingRecord | null>
  updateBookingStatus: (phone: string, email: string, status: BookingRecord['status']) => Promise<BookingRecord>
  updateBookingDetails: (
    phone: string,
    email: string,
    patch: Pick<BookingRecord, 'className' | 'trainer' | 'date'>,
  ) => Promise<BookingRecord>
  sendChat: (message: string) => Promise<string>
}
