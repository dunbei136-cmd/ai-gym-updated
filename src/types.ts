export type FAQItem = {
  question: string
  answer: string
}

export type BookingStatus = '已確認' | '待回覆' | '已完成'
export type LeadStage = '新名單' | '已聯繫' | '已預約體驗' | '已成交' | '流失'
export type LeadSource = '網站表單' | 'AI 聊天' | 'LINE' | '電話' | 'Walk-in'

export type BookingRecord = {
  name: string
  phone: string
  email: string
  className: string
  trainer: string
  date: string
  status: BookingStatus
  notes: string
  stage: LeadStage
  source: LeadSource
  assignee: string
  nextFollowUpAt: string
  createdAt: string
  updatedAt: string
}

export type BookingDetailPatch = Pick<
  BookingRecord,
  'name' | 'className' | 'trainer' | 'date' | 'notes' | 'stage' | 'source' | 'assignee' | 'nextFollowUpAt'
>

export type ChatMessage = {
  role: 'assistant' | 'user'
  content: string
}

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
  updateBookingStatus: (phone: string, email: string, status: BookingStatus) => Promise<BookingRecord>
  updateBookingDetails: (
    phone: string,
    email: string,
    patch: BookingDetailPatch,
  ) => Promise<BookingRecord>
  deleteBooking: (phone: string, email: string) => Promise<void>
  sendChat: (message: string) => Promise<string>
}
