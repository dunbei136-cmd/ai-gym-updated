import { z } from 'zod'

export const validStatuses = ['待回覆', '已確認', '已完成']
export const validStages = ['新名單', '已聯繫', '已預約體驗', '已成交', '流失']
export const validSources = ['網站表單', 'AI 聊天', 'LINE', '電話', 'Walk-in']

const trimmedString = z.string().trim()
const optionalTrimmedString = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((value) => (typeof value === 'string' ? value.trim() : ''))

export const authLoginSchema = z.object({
  username: trimmedString.min(1, 'username is required'),
  password: z.string().min(1, 'password is required'),
})

export const createBookingSchema = z.object({
  name: trimmedString.min(1, 'name is required'),
  phone: trimmedString.min(1, 'phone is required'),
  email: trimmedString.min(1, 'email is required').transform((value) => value.toLowerCase()),
  goal: optionalTrimmedString.default('減脂 / 新手入門'),
  preferredSlot: optionalTrimmedString.default('平日晚上'),
})

export const bookingLookupSchema = z.object({
  phone: trimmedString.min(1, 'phone is required'),
  email: trimmedString.min(1, 'email is required').transform((value) => value.toLowerCase()),
})

export const updateBookingStatusSchema = z.object({
  phone: trimmedString.min(1, 'phone is required'),
  email: trimmedString.min(1, 'email is required').transform((value) => value.toLowerCase()),
  status: z.enum(validStatuses, { message: 'status is invalid' }),
})

export const updateBookingDetailsSchema = z.object({
  phone: trimmedString.min(1, 'phone is required'),
  email: trimmedString.min(1, 'email is required').transform((value) => value.toLowerCase()),
  name: trimmedString.min(1, 'name is required'),
  className: trimmedString.min(1, 'className is required'),
  trainer: trimmedString.min(1, 'trainer is required'),
  date: trimmedString.min(1, 'date is required'),
  notes: optionalTrimmedString,
  stage: z.enum(validStages, { message: 'stage is invalid' }),
  source: z.enum(validSources, { message: 'source is invalid' }),
  assignee: optionalTrimmedString.transform((value) => value || '未指派'),
  nextFollowUpAt: optionalTrimmedString,
  activityLog: z.array(z.string()).optional().default([]),
})

export const deleteBookingSchema = z.object({
  phone: trimmedString.min(1, 'phone is required'),
  email: trimmedString.min(1, 'email is required').transform((value) => value.toLowerCase()),
})

export const chatMessageSchema = z.object({
  message: trimmedString.min(2, 'message must be at least 2 characters'),
})

export function parseBody(schema, payload) {
  const result = schema.safeParse(payload)
  if (result.success) {
    return { ok: true, data: result.data }
  }

  const issues = result.error.issues.map((issue) => ({
    path: issue.path.join('.') || 'root',
    message: issue.message,
  }))

  return {
    ok: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: issues[0]?.message || 'Invalid request payload',
      details: issues,
    },
  }
}
