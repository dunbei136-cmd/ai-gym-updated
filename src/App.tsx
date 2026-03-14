import './App.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { faqItems, plans, quickReplies, testimonials } from './data/content'
import { api, apiModeLabel } from './lib/api'
import type { AuthSession, BookingDetailPatch, BookingRecord, BookingStatus, ChatMessage, HealthSnapshot, LeadForm, LeadSource, LeadStage } from './types'

const stageOptions: LeadStage[] = ['新名單', '已聯繫', '已預約體驗', '已成交', '流失']
const sourceOptions: LeadSource[] = ['網站表單', 'AI 聊天', 'LINE', '電話', 'Walk-in']

function toDateTimeInputValue(value: string) {
  const matched = value.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/)
  if (!matched) return ''

  const [, year, month, day, hour, minute] = matched
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function fromDateTimeInputValue(value: string) {
  if (!value) return ''
  const [datePart, timePart] = value.split('T')
  if (!datePart || !timePart) return value
  return `${datePart.replaceAll('-', '/')} ${timePart}`
}

function formatBookingDateLabel(value: string) {
  const matched = value.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/)
  if (!matched) return value

  const [, year, month, day, hour, minute] = matched
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`)
  if (Number.isNaN(date.getTime())) return value

  const weekday = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][date.getDay()]
  return `${year}/${month}/${day} ${weekday} ${hour}:${minute}`
}

function getBookingKey(booking: Pick<BookingRecord, 'phone' | 'email'>) {
  return `${booking.phone}-${booking.email}`
}

function getBookingDateOnly(value: string) {
  const matched = value.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+/)
  if (!matched) return ''
  const [, year, month, day] = matched
  return `${year}-${month}-${day}`
}

function formatAuditTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatFollowUpLabel(value: string) {
  if (!value) return '未安排'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function isOverdueBooking(booking: BookingRecord) {
  if (booking.status === '已完成') return false

  const matched = booking.date.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/)
  if (!matched) return false

  const [, year, month, day, hour, minute] = matched
  const bookingTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`)
  if (Number.isNaN(bookingTime.getTime())) return false

  return bookingTime.getTime() < Date.now()
}

function isFollowUpDue(value: string) {
  if (!value) return false
  const timestamp = new Date(value).getTime()
  return !Number.isNaN(timestamp) && timestamp <= Date.now()
}

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toLocalDateTimeValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function getSortIndicator(active: boolean) {
  return active ? ' ↓' : ''
}

function normalizeChatReply(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function getSafeAssistantReply(nextReply: string, previousAssistantReply?: string) {
  const normalizedNext = normalizeChatReply(nextReply)
  const normalizedPrevious = normalizeChatReply(previousAssistantReply ?? '')

  if (!normalizedNext) {
    return '我在，你可以直接跟我說想了解課程、價格、時段，或是想查預約，我幫你接下去。'
  }

  if (!normalizedPrevious || normalizedNext !== normalizedPrevious) {
    return nextReply
  }

  return '我在，你可以直接跟我說想了解課程、價格、時段，或是想查預約，我幫你接下去。'
}

function createActivityLogEntry(note: string) {
  const trimmed = note.trim()
  if (!trimmed) return ''

  const timestamp = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(' ', ' ')

  return `${timestamp} ${trimmed}`
}

function App() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '歡迎來到 PulseFit AI。你可以直接問我課程、費用、體驗流程，或用下方功能查詢預約。',
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatCooldownUntil, setChatCooldownUntil] = useState(0)
  const [lookupPhone, setLookupPhone] = useState('0912345678')
  const [lookupEmail, setLookupEmail] = useState('amy.demo@example.com')
  const [activeFaq, setActiveFaq] = useState<number | null>(0)
  const [form, setForm] = useState<LeadForm>({
    name: '',
    phone: '',
    email: '',
    goal: '減脂 / 新手入門',
    preferredSlot: '平日晚上',
  })
  const [leadSubmitted, setLeadSubmitted] = useState<BookingRecord | null>(null)
  const [authSession, setAuthSession] = useState<AuthSession | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authForm, setAuthForm] = useState({ username: 'admin', password: 'pulsefit-demo' })
  const [adminForm, setAdminForm] = useState<LeadForm>({
    name: '',
    phone: '',
    email: '',
    goal: '減脂 / 新手入門',
    preferredSlot: '平日晚上',
  })
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [healthSnapshot, setHealthSnapshot] = useState<HealthSnapshot | null>(null)
  const [lookupResult, setLookupResult] = useState<BookingRecord | null>(null)
  const [lookupTouched, setLookupTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [updatingKey, setUpdatingKey] = useState('')
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null)
  const [detailForm, setDetailForm] = useState<BookingDetailPatch>({
    name: '',
    className: '',
    trainer: '',
    date: '',
    notes: '',
    stage: '新名單',
    source: '網站表單',
    assignee: '未指派',
    nextFollowUpAt: '',
    activityLog: [],
  })
  const [activityDraft, setActivityDraft] = useState('')
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailDeleting, setDetailDeleting] = useState(false)
  const [adminQuery, setAdminQuery] = useState('')
  const [adminStatus, setAdminStatus] = useState<'全部' | BookingStatus>('全部')
  const [adminStage, setAdminStage] = useState<'全部階段' | LeadStage>('全部階段')
  const [adminSource, setAdminSource] = useState<'全部來源' | LeadSource>('全部來源')
  const [adminTrainer, setAdminTrainer] = useState('全部教練')
  const [adminClass, setAdminClass] = useState('全部課程')
  const [adminAssignee, setAdminAssignee] = useState('全部負責人')
  const [adminSort, setAdminSort] = useState<'最近更新' | '最早更新' | '預約時間新→舊' | '姓名 A-Z' | '追蹤時間近→遠'>('最近更新')
  const [adminStartDate, setAdminStartDate] = useState('')
  const [adminEndDate, setAdminEndDate] = useState('')
  const [adminOverdueOnly, setAdminOverdueOnly] = useState(false)
  const [adminFollowUpOnly, setAdminFollowUpOnly] = useState(false)
  const [adminPage, setAdminPage] = useState(1)
  const [adminPageSize, setAdminPageSize] = useState<5 | 10 | 20>(5)
  const [adminSelectedOnly, setAdminSelectedOnly] = useState(false)
  const [selectedBookingKeys, setSelectedBookingKeys] = useState<string[]>([])
  const [batchStatus, setBatchStatus] = useState<BookingStatus>('待回覆')
  const [batchStage, setBatchStage] = useState<'不變' | LeadStage>('不變')
  const [batchAssignee, setBatchAssignee] = useState('')
  const [dragBookingKey, setDragBookingKey] = useState('')
  const [dragStageTarget, setDragStageTarget] = useState<LeadStage | ''>('')

  useEffect(() => {
    setAuthLoading(true)
    void api.getSession().then(setAuthSession).finally(() => setAuthLoading(false))

    void api.getHealth().then(setHealthSnapshot).catch(() => undefined)

    setLoadingBookings(true)
    void api
      .listBookings()
      .then(setBookings)
      .catch(() => setError('載入 booking 資料失敗'))
      .finally(() => setLoadingBookings(false))
  }, [])

  useEffect(() => {
    if (!lookupPhone.trim() || !lookupEmail.trim()) return

    let cancelled = false
    setLookupTouched(true)

    void api.lookupBooking(lookupPhone, lookupEmail).then((result) => {
      if (!cancelled) setLookupResult(result)
    })

    return () => {
      cancelled = true
    }
  }, [lookupEmail, lookupPhone])

  useEffect(() => {
    if (!chatCooldownUntil || chatCooldownUntil <= Date.now()) return
    const timer = window.setTimeout(() => setChatCooldownUntil(0), chatCooldownUntil - Date.now())
    return () => window.clearTimeout(timer)
  }, [chatCooldownUntil])

  useEffect(() => {
    if (!selectedBooking) return

    const refreshed = bookings.find(
      (item) => item.phone === selectedBooking.phone && item.email === selectedBooking.email,
    )

    if (refreshed) {
      setSelectedBooking(refreshed)
    }
  }, [bookings, selectedBooking])

  useEffect(() => {
    if (!selectedBooking) return

    setDetailForm({
      name: selectedBooking.name,
      className: selectedBooking.className,
      trainer: selectedBooking.trainer,
      date: selectedBooking.date,
      notes: selectedBooking.notes,
      stage: selectedBooking.stage,
      source: selectedBooking.source,
      assignee: selectedBooking.assignee,
      nextFollowUpAt: selectedBooking.nextFollowUpAt,
      activityLog: selectedBooking.activityLog,
    })
    setActivityDraft('')
  }, [selectedBooking])

  const stats = useMemo(
    () => [
      { value: 'Deployable', label: '可上靜態主機' },
      { value: apiModeLabel, label: '資料層可切換' },
      { value: `${bookings.length}`, label: '可查詢 booking' },
    ],
    [bookings.length],
  )

  const adminStats = useMemo(
    () => ({
      total: bookings.length,
      pending: bookings.filter((item) => item.status === '待回覆').length,
      confirmed: bookings.filter((item) => item.status === '已確認').length,
      completed: bookings.filter((item) => item.status === '已完成').length,
    }),
    [bookings],
  )

  const crmStats = useMemo(
    () => ({
      newLeads: bookings.filter((item) => item.stage === '新名單').length,
      contacted: bookings.filter((item) => item.stage === '已聯繫').length,
      trial: bookings.filter((item) => item.stage === '已預約體驗').length,
      won: bookings.filter((item) => item.stage === '已成交').length,
      lost: bookings.filter((item) => item.stage === '流失').length,
      followUpDue: bookings.filter((item) => isFollowUpDue(item.nextFollowUpAt)).length,
    }),
    [bookings],
  )

  const trainerOptions = ['全部教練', ...new Set(bookings.map((booking) => booking.trainer))]
  const classOptions = ['全部課程', ...new Set(bookings.map((booking) => booking.className))]
  const assigneeOptions = ['全部負責人', ...new Set(bookings.map((booking) => booking.assignee || '未指派'))]

  const filteredBookings = useMemo(() => {
    const filtered = bookings.filter((booking) => {
      const matchStatus = adminStatus === '全部' ? true : booking.status === adminStatus
      const matchStage = adminStage === '全部階段' ? true : booking.stage === adminStage
      const matchSource = adminSource === '全部來源' ? true : booking.source === adminSource
      const matchAssignee = adminAssignee === '全部負責人' ? true : booking.assignee === adminAssignee
      const keyword = adminQuery.trim().toLowerCase()
      const matchKeyword =
        !keyword ||
        booking.name.toLowerCase().includes(keyword) ||
        booking.phone.includes(keyword) ||
        booking.email.toLowerCase().includes(keyword) ||
        booking.className.toLowerCase().includes(keyword) ||
        booking.notes.toLowerCase().includes(keyword) ||
        booking.assignee.toLowerCase().includes(keyword)

      const bookingDateOnly = getBookingDateOnly(booking.date)
      const matchStartDate = !adminStartDate || (bookingDateOnly && bookingDateOnly >= adminStartDate)
      const matchEndDate = !adminEndDate || (bookingDateOnly && bookingDateOnly <= adminEndDate)
      const matchTrainer = adminTrainer === '全部教練' ? true : booking.trainer === adminTrainer
      const matchClass = adminClass === '全部課程' ? true : booking.className === adminClass
      const matchOverdueOnly = !adminOverdueOnly || isOverdueBooking(booking)
      const matchFollowUpOnly = !adminFollowUpOnly || isFollowUpDue(booking.nextFollowUpAt)
      const matchSelectedOnly = !adminSelectedOnly || selectedBookingKeys.includes(getBookingKey(booking))

      return (
        matchStatus &&
        matchStage &&
        matchSource &&
        matchAssignee &&
        matchKeyword &&
        matchStartDate &&
        matchEndDate &&
        matchTrainer &&
        matchClass &&
        matchOverdueOnly &&
        matchFollowUpOnly &&
        matchSelectedOnly
      )
    })

    const sorted = [...filtered]

    if (adminSort === '姓名 A-Z') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
      return sorted
    }

    if (adminSort === '預約時間新→舊') {
      sorted.sort((a, b) => b.date.localeCompare(a.date))
      return sorted
    }

    if (adminSort === '追蹤時間近→遠') {
      sorted.sort((a, b) => {
        if (!a.nextFollowUpAt && !b.nextFollowUpAt) return 0
        if (!a.nextFollowUpAt) return 1
        if (!b.nextFollowUpAt) return -1
        return a.nextFollowUpAt.localeCompare(b.nextFollowUpAt)
      })
      return sorted
    }

    sorted.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    return adminSort === '最早更新' ? sorted : sorted.reverse()
  }, [adminAssignee, adminClass, adminEndDate, adminFollowUpOnly, adminOverdueOnly, adminQuery, adminSelectedOnly, adminSort, adminSource, adminStage, adminStartDate, adminStatus, adminTrainer, bookings, selectedBookingKeys])

  const pipelineColumns = useMemo(
    () =>
      stageOptions.map((stage) => ({
        stage,
        bookings: filteredBookings.filter((booking) => booking.stage === stage),
      })),
    [filteredBookings],
  )

  useEffect(() => {
    setAdminPage(1)
  }, [adminAssignee, adminClass, adminEndDate, adminFollowUpOnly, adminOverdueOnly, adminPageSize, adminQuery, adminSelectedOnly, adminSort, adminSource, adminStage, adminStartDate, adminStatus, adminTrainer])

  useEffect(() => {
    const validKeys = new Set(bookings.map((booking) => getBookingKey(booking)))
    setSelectedBookingKeys((prev) => prev.filter((key) => validKeys.has(key)))
  }, [bookings])

  const totalAdminPages = Math.max(1, Math.ceil(filteredBookings.length / adminPageSize))
  const safeAdminPage = Math.min(adminPage, totalAdminPages)
  const paginatedBookings = filteredBookings.slice(
    (safeAdminPage - 1) * adminPageSize,
    safeAdminPage * adminPageSize,
  )
  const paginatedBookingKeys = paginatedBookings.map((booking) => getBookingKey(booking))
  const selectedOnPageCount = paginatedBookingKeys.filter((key) => selectedBookingKeys.includes(key)).length
  const allOnPageSelected = paginatedBookingKeys.length > 0 && selectedOnPageCount === paginatedBookingKeys.length
  const activeFilterLabels = [
    adminQuery ? `關鍵字：${adminQuery}` : '',
    adminStatus !== '全部' ? `狀態：${adminStatus}` : '',
    adminStage !== '全部階段' ? `階段：${adminStage}` : '',
    adminSource !== '全部來源' ? `來源：${adminSource}` : '',
    adminAssignee !== '全部負責人' ? `負責人：${adminAssignee}` : '',
    adminTrainer !== '全部教練' ? `教練：${adminTrainer}` : '',
    adminClass !== '全部課程' ? `課程：${adminClass}` : '',
    adminSort !== '最近更新' ? `排序：${adminSort}` : '',
    adminStartDate ? `開始：${adminStartDate}` : '',
    adminEndDate ? `結束：${adminEndDate}` : '',
    adminOverdueOnly ? '只看逾期待處理' : '',
    adminFollowUpOnly ? '只看待追蹤' : '',
    adminSelectedOnly ? '只看已勾選' : '',
  ].filter(Boolean)

  const filteredAdminStats = {
    total: filteredBookings.length,
    pending: filteredBookings.filter((booking) => booking.status === '待回覆').length,
    confirmed: filteredBookings.filter((booking) => booking.status === '已確認').length,
    completed: filteredBookings.filter((booking) => booking.status === '已完成').length,
  }

  const selectedBookingIndex = selectedBooking
    ? filteredBookings.findIndex(
        (item) => item.phone === selectedBooking.phone && item.email === selectedBooking.email,
      )
    : -1
  const previousBooking = selectedBookingIndex > 0 ? filteredBookings[selectedBookingIndex - 1] : null
  const nextBooking =
    selectedBookingIndex >= 0 && selectedBookingIndex < filteredBookings.length - 1
      ? filteredBookings[selectedBookingIndex + 1]
      : null
  const hasUnsavedDetailChanges =
    !!selectedBooking &&
    (detailForm.name !== selectedBooking.name ||
      detailForm.className !== selectedBooking.className ||
      detailForm.trainer !== selectedBooking.trainer ||
      detailForm.date !== selectedBooking.date ||
      detailForm.notes !== selectedBooking.notes ||
      detailForm.stage !== selectedBooking.stage ||
      detailForm.source !== selectedBooking.source ||
      detailForm.assignee !== selectedBooking.assignee ||
      detailForm.nextFollowUpAt !== selectedBooking.nextFollowUpAt ||
      JSON.stringify(detailForm.activityLog) !== JSON.stringify(selectedBooking.activityLog))
  const interactionLocked = busy || detailSaving || detailDeleting || !!dragBookingKey || authLoading
  const adminWriteLocked = interactionLocked || !authSession
  const detailFormLocked = detailSaving || detailDeleting || !authSession
  const busyLabel = detailSaving
    ? '正在儲存 booking / CRM 明細...'
    : detailDeleting
      ? '正在刪除 booking...'
      : dragBookingKey
        ? '正在更新 pipeline 階段...'
        : busy
          ? '正在處理 admin 操作...'
          : ''

  const sendMessage = async (value?: string) => {
    const message = (value ?? chatInput).trim()
    if (!message) return

    if (message.length < 2) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '問題可以再具體一點，例如「會員費用多少」或「幫我推薦新手課」。' },
      ])
      return
    }

    if (Date.now() < chatCooldownUntil) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '先等一下，我剛回完上一題，避免重複送出。' },
      ])
      return
    }

    const lastUserMessage = [...chatMessages].reverse().find((item) => item.role === 'user')
    if (lastUserMessage && lastUserMessage.content.trim() === message) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '這題你剛剛問過，我已經回在上面了；若要我換個角度回答，可以直接補充條件。' },
      ])
      return
    }

    setChatCooldownUntil(Date.now() + 1500)

    const userMessage: ChatMessage = { role: 'user', content: message }
    setChatMessages((prev) => [...prev, userMessage])
    setChatInput('')

    try {
      const reply = await api.sendChat(message)
      setChatMessages((prev) => {
        const previousAssistantReply = [...prev].reverse().find((item) => item.role === 'assistant')?.content
        return [...prev, { role: 'assistant', content: getSafeAssistantReply(reply, previousAssistantReply) }]
      })
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '目前暫時無法連線聊天服務，請稍後再試。' },
      ])
    }
  }

  const updateForm = <K extends keyof LeadForm>(key: K, value: LeadForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateAdminForm = <K extends keyof LeadForm>(key: K, value: LeadForm[K]) => {
    setAdminForm((prev) => ({ ...prev, [key]: value }))
  }

  const ensureAdminSession = () => {
    if (authSession) return true
    setAuthError('請先登入後台帳號')
    setError('請先登入後台帳號')
    return false
  }

  const submitAdminLogin = async () => {
    if (!authForm.username.trim() || !authForm.password) {
      setAuthError('請輸入帳號與密碼')
      return
    }

    setAuthBusy(true)
    setAuthError('')
    try {
      const session = await api.login({ username: authForm.username.trim(), password: authForm.password })
      setAuthSession(session)
      setNotice(`已登入後台：${session.username}`)
      setError('')
    } catch (loginError) {
      setAuthError(loginError instanceof Error ? loginError.message : '登入失敗，請稍後再試')
    } finally {
      setAuthBusy(false)
    }
  }

  const logoutAdmin = async () => {
    setAuthBusy(true)
    try {
      await api.logout()
      setAuthSession(null)
      setAuthForm((prev) => ({ ...prev, password: 'pulsefit-demo' }))
      setNotice('已登出後台帳號')
    } finally {
      setAuthBusy(false)
    }
  }

  const submitLead = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      setError('請至少填寫姓名、手機與 Email')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')

    try {
      const booking = await api.createBooking(form)
      setLeadSubmitted(booking)
      setLookupPhone(booking.phone)
      setLookupEmail(booking.email)
      setLookupResult(booking)
      setBookings(await api.listBookings())
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: `我想預約 ${form.goal}` },
        {
          role: 'assistant',
          content: `已為 ${booking.name} 建立 demo 預約。你現在可以直接到 Booking Lookup 用 ${booking.phone} + ${booking.email} 查詢。`,
        },
      ])
      setNotice(`已建立 ${booking.name} 的預約資料`)
    } catch {
      setError('建立預約失敗，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

  const submitAdminBooking = async () => {
    if (!ensureAdminSession()) return

    if (!adminForm.name.trim() || !adminForm.phone.trim() || !adminForm.email.trim()) {
      setError('後台新增預約時，姓名、手機與 Email 都要填寫')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')

    try {
      const booking = await api.createBooking(adminForm)
      const nextBookings = await api.listBookings()
      setBookings(nextBookings)
      setSelectedBooking(nextBookings.find((item) => getBookingKey(item) === getBookingKey(booking)) ?? booking)
      setAdminStatus('全部')
      setAdminStage('全部階段')
      setAdminSource('全部來源')
      setAdminAssignee('全部負責人')
      setAdminQuery('')
      setAdminForm({
        name: '',
        phone: '',
        email: '',
        goal: '減脂 / 新手入門',
        preferredSlot: '平日晚上',
      })
      setNotice(`後台已建立 ${booking.name} 的預約資料`)
    } catch {
      setError('後台建立預約失敗，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

  const toggleBookingSelection = (booking: Pick<BookingRecord, 'phone' | 'email'>) => {
    const key = getBookingKey(booking)
    setSelectedBookingKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    )
  }

  const toggleSelectCurrentPage = () => {
    setSelectedBookingKeys((prev) => {
      if (allOnPageSelected) {
        return prev.filter((key) => !paginatedBookingKeys.includes(key))
      }

      return [...new Set([...prev, ...paginatedBookingKeys])]
    })
  }

  const selectAllFilteredBookings = () => {
    setSelectedBookingKeys(filteredBookings.map((booking) => getBookingKey(booking)))
  }

  const clearSelectedBookings = () => {
    setSelectedBookingKeys([])
  }

  const resetAdminFilters = () => {
    setAdminQuery('')
    setAdminStatus('全部')
    setAdminStage('全部階段')
    setAdminSource('全部來源')
    setAdminTrainer('全部教練')
    setAdminClass('全部課程')
    setAdminAssignee('全部負責人')
    setAdminSort('最近更新')
    setAdminStartDate('')
    setAdminEndDate('')
    setAdminOverdueOnly(false)
    setAdminFollowUpOnly(false)
    setAdminSelectedOnly(false)
    setAdminPage(1)
  }

  const applyTodayFilter = () => {
    const today = toLocalDateInputValue(new Date())
    setAdminStartDate(today)
    setAdminEndDate(today)
  }

  const applyThisWeekFilter = () => {
    const now = new Date()
    const start = new Date(now)
    const end = new Date(now)
    const day = now.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    start.setDate(now.getDate() + diffToMonday)
    end.setDate(start.getDate() + 6)
    setAdminStartDate(toLocalDateInputValue(start))
    setAdminEndDate(toLocalDateInputValue(end))
  }

  const copyToClipboard = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setError('')
      setNotice(`已複製${label}：${value}`)
    } catch {
      setError(`複製${label}失敗，請稍後再試`)
    }
  }

  const scheduleFollowUp = (hours: number) => {
    const base = detailForm.nextFollowUpAt ? new Date(detailForm.nextFollowUpAt) : new Date()
    if (Number.isNaN(base.getTime())) return
    base.setHours(base.getHours() + hours)
    setDetailForm((prev) => ({ ...prev, nextFollowUpAt: toLocalDateTimeValue(base) }))
  }

  const downloadBookingsCsv = (targetBookings: BookingRecord[], filePrefix: string) => {
    const rows = [
      ['姓名', '手機', 'Email', '課程', '教練', '預約時間', '狀態', '名單階段', '來源', '負責人', '下次追蹤', '備註', '建立時間', '更新時間'],
      ...targetBookings.map((booking) => [
        booking.name,
        booking.phone,
        booking.email,
        booking.className,
        booking.trainer,
        booking.date,
        booking.status,
        booking.stage,
        booking.source,
        booking.assignee,
        booking.nextFollowUpAt,
        booking.notes,
        booking.createdAt,
        booking.updatedAt,
      ]),
    ]

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filePrefix}-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportBookingsCsv = () => {
    downloadBookingsCsv(filteredBookings, 'pulsefit-bookings')
  }

  const exportSelectedBookingsCsv = () => {
    const targetBookings = bookings.filter((booking) => selectedBookingKeys.includes(getBookingKey(booking)))
    downloadBookingsCsv(targetBookings, 'pulsefit-selected-bookings')
  }

  const copySelectedContacts = async (field: 'phone' | 'email', label: string) => {
    const targetBookings = bookings.filter((booking) => selectedBookingKeys.includes(getBookingKey(booking)))
    const uniqueValues = [...new Set(targetBookings.map((booking) => booking[field]).filter(Boolean))]

    if (uniqueValues.length === 0) {
      setError(`目前沒有可複製的${label}`)
      return
    }

    try {
      await navigator.clipboard.writeText(uniqueValues.join('\n'))
      setError('')
      setNotice(`已複製 ${uniqueValues.length} 筆${label}`)
    } catch {
      setError(`複製${label}失敗，請稍後再試`)
    }
  }

  const changeBookingStatus = async (
    phone: string,
    email: string,
    status: BookingStatus,
  ) => {
    if (!ensureAdminSession()) return
    const key = `${phone}-${email}`
    setUpdatingKey(key)
    setError('')
    setNotice('')

    try {
      const updated = await api.updateBookingStatus(phone, email, status)
      const nextBookings = await api.listBookings()
      setBookings(nextBookings)

      if (lookupResult && lookupResult.phone === updated.phone && lookupResult.email === updated.email) {
        setLookupResult(updated)
      }

      setNotice(`已更新 ${updated.name} 的狀態為 ${updated.status}`)
    } catch {
      setError('更新狀態失敗，請稍後再試')
    } finally {
      setUpdatingKey('')
    }
  }

  const updateSelectedBookingsStatus = async () => {
    if (!ensureAdminSession()) return

    if (selectedBookingKeys.length === 0) {
      setError('請先勾選至少一筆 booking')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')

    try {
      const targets = bookings.filter((booking) => selectedBookingKeys.includes(getBookingKey(booking)))
      await Promise.all(
        targets.map((booking) => api.updateBookingStatus(booking.phone, booking.email, batchStatus)),
      )
      const nextBookings = await api.listBookings()
      setBookings(nextBookings)
      setSelectedBookingKeys([])
      setNotice(`已批次更新 ${targets.length} 筆預約狀態為 ${batchStatus}`)
    } catch {
      setError('批次更新狀態失敗，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

  const updateSelectedBookingsCrm = async () => {
    if (!ensureAdminSession()) return

    if (selectedBookingKeys.length === 0) {
      setError('請先勾選至少一筆 booking')
      return
    }

    if (batchStage === '不變' && !batchAssignee.trim()) {
      setError('請至少選一個 CRM 欄位更新：stage 或 assignee')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')

    try {
      const targets = bookings.filter((booking) => selectedBookingKeys.includes(getBookingKey(booking)))
      await Promise.all(
        targets.map((booking) =>
          api.updateBookingDetails(booking.phone, booking.email, {
            name: booking.name,
            className: booking.className,
            trainer: booking.trainer,
            date: booking.date,
            notes: booking.notes,
            source: booking.source,
            nextFollowUpAt: booking.nextFollowUpAt,
            activityLog: booking.activityLog,
            stage: batchStage === '不變' ? booking.stage : batchStage,
            assignee: batchAssignee.trim() || booking.assignee,
          }),
        ),
      )
      const nextBookings = await api.listBookings()
      setBookings(nextBookings)
      setSelectedBookingKeys([])
      setBatchStage('不變')
      setBatchAssignee('')
      setNotice(`已批次更新 ${targets.length} 筆 CRM 欄位`)
    } catch {
      setError('批次更新 CRM 欄位失敗，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

  const moveBookingToStage = async (booking: BookingRecord, stage: LeadStage) => {
    if (!ensureAdminSession()) return

    if (booking.stage === stage) {
      setDragBookingKey('')
      setDragStageTarget('')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    setDragBookingKey(getBookingKey(booking))
    setDragStageTarget(stage)

    try {
      const updated = await api.updateBookingDetails(booking.phone, booking.email, {
        name: booking.name,
        className: booking.className,
        trainer: booking.trainer,
        date: booking.date,
        notes: booking.notes,
        stage,
        source: booking.source,
        assignee: booking.assignee,
        nextFollowUpAt: booking.nextFollowUpAt,
        activityLog: booking.activityLog,
      })
      const nextBookings = await api.listBookings()
      setBookings(nextBookings)
      if (selectedBooking && getBookingKey(selectedBooking) === getBookingKey(booking)) {
        setSelectedBooking(updated)
      }
      if (lookupResult && getBookingKey(lookupResult) === getBookingKey(booking)) {
        setLookupResult(updated)
      }
      setNotice(`已將 ${booking.name} 移到「${stage}」`)
    } catch {
      setError('更新 pipeline 階段失敗，請稍後再試')
    } finally {
      setBusy(false)
      setDragBookingKey('')
      setDragStageTarget('')
    }
  }

  const deleteSelectedBookings = async () => {
    if (!ensureAdminSession()) return

    if (selectedBookingKeys.length === 0) {
      setError('請先勾選至少一筆 booking')
      return
    }

    const confirmed = window.confirm(`確定要刪除已勾選的 ${selectedBookingKeys.length} 筆 booking 嗎？`)
    if (!confirmed) return

    setBusy(true)
    setError('')
    setNotice('')

    try {
      const targets = bookings.filter((booking) => selectedBookingKeys.includes(getBookingKey(booking)))
      await Promise.all(targets.map((booking) => api.deleteBooking(booking.phone, booking.email)))
      const nextBookings = await api.listBookings()
      setBookings(nextBookings)
      setSelectedBookingKeys([])

      if (selectedBooking && targets.some((booking) => getBookingKey(booking) === getBookingKey(selectedBooking))) {
        setSelectedBooking(null)
      }

      if (lookupResult && targets.some((booking) => booking.phone === lookupResult.phone && booking.email === lookupResult.email)) {
        setLookupResult(null)
      }

      setNotice(`已刪除 ${targets.length} 筆 booking`)
    } catch {
      setError('批次刪除失敗，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

  const updateDetailForm = <K extends keyof BookingDetailPatch>(
    key: K,
    value: BookingDetailPatch[K],
  ) => {
    setDetailForm((prev) => ({ ...prev, [key]: value }))
  }

  const appendNoteTemplate = (template: string) => {
    setDetailForm((prev) => ({
      ...prev,
      notes: prev.notes.trim() ? `${prev.notes.trim()}\n${template}` : template,
    }))
  }

  const appendActivityLogTemplate = (template: string) => {
    const nextEntry = createActivityLogEntry(template)
    if (!nextEntry) return

    setDetailForm((prev) => ({
      ...prev,
      activityLog: [nextEntry, ...prev.activityLog],
    }))
  }

  const addActivityLogEntry = () => {
    const nextEntry = createActivityLogEntry(activityDraft)
    if (!nextEntry) {
      setError('請先輸入聯絡紀錄內容')
      return
    }

    setDetailForm((prev) => ({
      ...prev,
      activityLog: [nextEntry, ...prev.activityLog],
    }))
    setActivityDraft('')
    setError('')
  }

  const removeActivityLogEntry = (targetIndex: number) => {
    setDetailForm((prev) => ({
      ...prev,
      activityLog: prev.activityLog.filter((_, index) => index !== targetIndex),
    }))
  }

  const confirmLeaveDirtyDetail = useCallback(() => {
    if (!hasUnsavedDetailChanges) return true
    return window.confirm('目前有未儲存的變更，確定要離開這筆 booking 嗎？')
  }, [hasUnsavedDetailChanges])

  const openBookingDetails = useCallback(
    (booking: BookingRecord) => {
      if (interactionLocked) return
      if (selectedBooking && getBookingKey(selectedBooking) === getBookingKey(booking)) return
      if (!confirmLeaveDirtyDetail()) return
      setSelectedBooking(booking)
      setError('')
    },
    [confirmLeaveDirtyDetail, interactionLocked, selectedBooking],
  )

  const saveBookingDetails = useCallback(async () => {
    if (!selectedBooking) return
    if (!ensureAdminSession()) return

    if (
      !detailForm.name.trim() ||
      !detailForm.className.trim() ||
      !detailForm.trainer.trim() ||
      !detailForm.date.trim()
    ) {
      setError('姓名、課程、教練與預約時間都要填寫')
      return
    }

    setDetailSaving(true)
    setError('')
    setNotice('')

    try {
      const updated = await api.updateBookingDetails(selectedBooking.phone, selectedBooking.email, {
        name: detailForm.name.trim(),
        className: detailForm.className.trim(),
        trainer: detailForm.trainer.trim(),
        date: detailForm.date.trim(),
        notes: detailForm.notes.trim(),
        stage: detailForm.stage,
        source: detailForm.source,
        assignee: detailForm.assignee.trim() || '未指派',
        nextFollowUpAt: detailForm.nextFollowUpAt,
        activityLog: detailForm.activityLog,
      })
      const nextBookings = await api.listBookings()
      setBookings(nextBookings)
      setSelectedBooking(updated)

      if (lookupResult && lookupResult.phone === updated.phone && lookupResult.email === updated.email) {
        setLookupResult(updated)
      }

      setNotice(`已儲存 ${updated.name} 的 booking / CRM 明細`)
    } catch {
      setError('更新 booking 明細失敗，請稍後再試')
    } finally {
      setDetailSaving(false)
    }
  }, [detailForm, lookupResult, selectedBooking])

  const deleteSelectedBooking = async () => {
    if (!selectedBooking) return
    if (!ensureAdminSession()) return

    const confirmed = window.confirm(`確定要刪除 ${selectedBooking.name} 的 booking 嗎？`)
    if (!confirmed) return

    setDetailDeleting(true)
    setError('')
    setNotice('')

    try {
      await api.deleteBooking(selectedBooking.phone, selectedBooking.email)
      const nextBookings = await api.listBookings()
      setBookings(nextBookings)

      if (lookupResult && lookupResult.phone === selectedBooking.phone && lookupResult.email === selectedBooking.email) {
        setLookupResult(null)
      }

      setSelectedBooking(null)
      setNotice(`已刪除 ${selectedBooking.name} 的 booking`)
    } catch {
      setError('刪除 booking 失敗，請稍後再試')
    } finally {
      setDetailDeleting(false)
    }
  }

  useEffect(() => {
    if (!selectedBooking) return

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (hasUnsavedDetailChanges && !detailSaving && !detailDeleting) {
          void saveBookingDetails()
        }
      }

      if (event.key === 'Escape') {
        if (detailSaving || detailDeleting) return
        if (!confirmLeaveDirtyDetail()) return
        setSelectedBooking(null)
        setError('')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmLeaveDirtyDetail, detailDeleting, detailSaving, hasUnsavedDetailChanges, saveBookingDetails, selectedBooking])

  return (
    <div className="app-shell">
      <nav className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">PF</div>
          <div>
            <strong>PulseFit AI</strong>
            <span>Gym Concierge Demo</span>
          </div>
        </div>
        <div className="topbar-links">
          <a href="#plans">方案</a>
          <a href="#chat-demo">聊天</a>
          <a href="#booking-lookup">查詢</a>
          <a href="#lead-capture">預約</a>
          <a href="#admin-snapshot">後台</a>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-copy glass-card">
          <span className="eyebrow">Brand-ready · API-ready · Deployable MVP</span>
          <h1>把健身房的接待、導流、預約查詢與 CRM 後台做成能 demo 的產品。</h1>
          <p className="hero-text">
            這不是只有視覺稿。現在這版已經有品牌化首頁、聊天入口、FAQ、方案展示、預約建立、查詢結果，以及 CRM-ready 的 admin 管理區。
          </p>
          <div className="hero-actions">
            <a href="#lead-capture" className="primary-btn">
              立即體驗預約流程
            </a>
            <a href="#admin-snapshot" className="secondary-btn">
              查看 CRM 後台
            </a>
          </div>
          <div className="hero-stats">
            {stats.map((item) => (
              <div key={item.label} className="stat-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="hero-side glass-card">
          <p className="section-kicker">這版可交付的東西</p>
          <ul className="bullet-list">
            <li>品牌化正式 UI</li>
            <li>可部署到 Vercel / Netlify</li>
            <li>Demo API 與 HTTP API 切換結構</li>
            <li>預約建立 → 查詢閉環</li>
            <li>CRM 名單階段 / 來源 / 負責人 / follow-up</li>
          </ul>
          <div className="mode-card">
            <span>Current mode</span>
            <strong>{apiModeLabel}</strong>
            <p>用 `.env` 切到 HTTP API 後，前端流程不用重寫。</p>
          </div>
        </aside>
      </header>

      <main className="page-shell">
        <section className="two-up-grid">
          <article className="section-card glass-card">
            <p className="section-kicker">使用者旅程</p>
            <h2>從 landing 到 booking 的完整前台流程</h2>
            <div className="feature-list">
              <div>
                <strong>聊天入口</strong>
                <p>先接住高頻問題，把訪客引導到最適合的方案或體驗課。</p>
              </div>
              <div>
                <strong>FAQ 自助化</strong>
                <p>把重複回答的成本降下來，讓客服只處理需要人介入的情境。</p>
              </div>
              <div>
                <strong>名單收集 + 預約建立</strong>
                <p>使用者可留下需求，系統立即產生一筆可查詢、可追蹤的 booking。</p>
              </div>
            </div>
          </article>

          <article className="section-card glass-card">
            <p className="section-kicker">正式版延伸</p>
            <h2>這個 UI 已經準備好接下一層 API</h2>
            <div className="feature-list slim">
              <div>
                <strong>HTTP API mode</strong>
                <p>可切到遠端 `/bookings`、`/bookings/lookup`、`/chat`。</p>
              </div>
              <div>
                <strong>CRM / 後台 / LINE OA</strong>
                <p>這版已把 CRM 核心欄位先做進來，之後可直接接正式後端與 webhook。</p>
              </div>
            </div>
          </article>
        </section>

        <section className="section-card glass-card" id="plans">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Program Showcase</p>
              <h2>品牌化方案展示</h2>
            </div>
            <p className="section-note">這一塊是銷售視角，不只是系統功能視角。</p>
          </div>
          <div className="plans-grid">
            {plans.map((plan) => (
              <article key={plan.name} className={`plan-card ${plan.highlight ? 'highlight' : ''}`}>
                <div className="plan-header">
                  <div>
                    <h3>{plan.name}</h3>
                    <p>{plan.description}</p>
                  </div>
                  <strong>{plan.price}</strong>
                </div>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="section-card glass-card" id="chat-demo">
          <div className="section-heading">
            <div>
              <p className="section-kicker">AI Chat Entry</p>
              <h2>聊天入口</h2>
            </div>
            <p className="section-note">目前已抽象成 API 介面，之後換真實聊天服務只需替換 adapter。</p>
          </div>
          <div className="chat-layout">
            <div className="chat-window">
              {chatMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`bubble-row ${message.role}`}>
                  <div className={`chat-bubble ${message.role}`}>{message.content}</div>
                </div>
              ))}
            </div>
            <div className="chat-sidebar">
              <div className="quick-replies">
                {quickReplies.map((reply) => (
                  <button key={reply} className="chip" onClick={() => void sendMessage(reply)} disabled={Date.now() < chatCooldownUntil}>
                    {reply}
                  </button>
                ))}
              </div>
              <div className="chat-input-row">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="例如：我是新手，想找減脂課程"
                />
                <button onClick={() => void sendMessage()} disabled={Date.now() < chatCooldownUntil || chatInput.trim().length < 2}>
                  送出
                </button>
              </div>
              <p className="chat-helper-note">建議直接問完整問題，例如「會員費用多少」或「幫我推薦新手課」，可降低 API 消耗。</p>
            </div>
          </div>
        </section>

        <section className="two-up-grid">
          <article className="section-card glass-card">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">FAQ</p>
                <h2>常見問題</h2>
              </div>
            </div>
            <div className="faq-list">
              {faqItems.map((item, index) => {
                const isOpen = activeFaq === index
                return (
                  <button
                    key={item.question}
                    className={`faq-item ${isOpen ? 'open' : ''}`}
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                  >
                    <div className="faq-question">
                      <span>{item.question}</span>
                      <span>{isOpen ? '－' : '＋'}</span>
                    </div>
                    {isOpen ? <p>{item.answer}</p> : null}
                  </button>
                )
              })}
            </div>
          </article>

          <article className="section-card glass-card" id="booking-lookup">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Booking Lookup</p>
                <h2>預約查詢</h2>
              </div>
              <p className="section-note">API-ready：正式版可改成真正查後端資料。</p>
            </div>

            <div className="lookup-form">
              <label>
                手機號碼
                <input value={lookupPhone} onChange={(event) => setLookupPhone(event.target.value)} />
              </label>
              <label>
                Email
                <input value={lookupEmail} onChange={(event) => setLookupEmail(event.target.value)} />
              </label>
            </div>

            <div className={`booking-card ${lookupResult ? 'success' : 'empty'}`}>
              {lookupResult ? (
                <>
                  <div className="booking-lookup-badges">
                    <span className={`status-pill status-${lookupResult.status}`}>{lookupResult.status}</span>
                    <span className={`crm-pill stage-${lookupResult.stage}`}>{lookupResult.stage}</span>
                  </div>
                  <h3>{lookupResult.name}</h3>
                  <ul>
                    <li>
                      <strong>課程：</strong>
                      {lookupResult.className}
                    </li>
                    <li>
                      <strong>教練：</strong>
                      {lookupResult.trainer}
                    </li>
                    <li>
                      <strong>時間：</strong>
                      {formatBookingDateLabel(lookupResult.date)}
                    </li>
                    <li>
                      <strong>聯絡方式：</strong>
                      {lookupResult.phone} / {lookupResult.email}
                    </li>
                  </ul>
                </>
              ) : lookupTouched ? (
                <>
                  <h3>查無資料</h3>
                  <p>你可以先用下方預約表單建立一筆資料，再回來查詢。</p>
                </>
              ) : (
                <p>輸入手機與 Email 後，會顯示對應的預約狀態。</p>
              )}
            </div>
          </article>
        </section>

        <section className="two-up-grid" id="lead-capture">
          <article className="section-card glass-card">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Lead Capture</p>
                <h2>體驗課預約 / 名單收集</h2>
              </div>
              <p className="section-note">現在這版可建立 demo booking；未來可直接改送到真後端。</p>
            </div>

            <div className="lead-form">
              <label>
                姓名
                <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="例如：王小明" />
              </label>
              <label>
                手機號碼
                <input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="例如：0912345678" />
              </label>
              <label>
                Email
                <input value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="例如：ming@example.com" />
              </label>
              <label>
                目標
                <select value={form.goal} onChange={(event) => updateForm('goal', event.target.value)}>
                  <option>減脂 / 新手入門</option>
                  <option>增肌 / 重訓規劃</option>
                  <option>姿勢矯正 / 體態改善</option>
                  <option>團體課 / 體驗參觀</option>
                </select>
              </label>
              <label>
                偏好時段
                <select value={form.preferredSlot} onChange={(event) => updateForm('preferredSlot', event.target.value)}>
                  <option>平日晚上</option>
                  <option>平日白天</option>
                  <option>週末上午</option>
                </select>
              </label>
              <button className="submit-btn" onClick={() => void submitLead()} disabled={busy}>
                {busy ? '送出中...' : '送出體驗課需求'}
              </button>
            </div>

            {error ? <p className="error-text">{error}</p> : null}

            <div className={`lead-result ${leadSubmitted ? 'success' : ''}`}>
              {leadSubmitted ? (
                <>
                  <strong>已建立 demo 預約</strong>
                  <p>
                    {leadSubmitted.name} / {leadSubmitted.phone} / {leadSubmitted.email}
                  </p>
                  <p>這筆名單會直接進 CRM 後台，預設階段為「新名單」。</p>
                </>
              ) : (
                <p>填完資料後，會建立一筆新的 booking，形成前台完整閉環。</p>
              )}
            </div>
          </article>

          <article className="section-card glass-card">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Trust Signals</p>
                <h2>示意使用回饋</h2>
              </div>
            </div>
            <div className="testimonial-list">
              {testimonials.map((item) => (
                <blockquote key={item.name}>
                  <p>“{item.quote}”</p>
                  <footer>{item.name}</footer>
                </blockquote>
              ))}
            </div>
          </article>
        </section>

        <section className="section-card glass-card" id="admin-snapshot">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Admin Dashboard</p>
              <h2>預約 / CRM 後台頁</h2>
            </div>
            <p className="section-note">直接讀 API booking 清單，帶搜尋、篩選、狀態總覽與 CRM 追蹤欄位。</p>
          </div>

          {error ? <p className="error-text admin-feedback">{error}</p> : null}
          {notice ? <p className="notice-text admin-feedback">{notice}</p> : null}
          {busyLabel ? <p className="admin-feedback admin-feedback-info">{busyLabel}</p> : null}

          <div className="admin-create-panel">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Admin Access</p>
                <h3>{authSession ? `已登入：${authSession.username}` : '登入後台'}</h3>
              </div>
              {authSession ? (
                <button className="secondary-btn" onClick={() => void logoutAdmin()} disabled={authBusy}>
                  {authBusy ? '處理中...' : '登出'}
                </button>
              ) : null}
            </div>
            {authSession ? (
              <p className="section-note">目前已啟用後台寫入權限，可更新狀態、CRM 與刪除資料。</p>
            ) : (
              <>
                <p className="section-note">目前為唯讀瀏覽模式；登入後才可進行新增、更新與刪除。</p>
                <p className="section-note">先登入後台帳號，才能執行狀態更新、CRM 編輯與刪除操作。</p>
                <div className="admin-create-grid">
                  <label>
                    帳號
                    <input value={authForm.username} onChange={(event) => setAuthForm((prev) => ({ ...prev, username: event.target.value }))} />
                  </label>
                  <label>
                    密碼
                    <input type="password" value={authForm.password} onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))} />
                  </label>
                  <div className="detail-field">
                    <span>示範帳密</span>
                    <strong>admin / pulsefit-demo</strong>
                  </div>
                  <button className="submit-btn admin-create-btn" onClick={() => void submitAdminLogin()} disabled={authBusy || authLoading}>
                    {authBusy ? '登入中...' : '登入後台'}
                  </button>
                </div>
                {authError ? <p className="error-text">{authError}</p> : null}
              </>
            )}
          </div>

          <div className="admin-create-panel">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Quick Create</p>
                <h3>後台直接新增預約 / 名單</h3>
              </div>
              <p className="section-note">用後台角度快速建立資料，建立後會自動選中這筆預約。</p>
            </div>

            <fieldset className="control-fieldset" disabled={adminWriteLocked}>
              <div className="admin-create-grid">
                <label>
                  姓名
                  <input value={adminForm.name} onChange={(event) => updateAdminForm('name', event.target.value)} placeholder="例如：王小明" />
                </label>
                <label>
                  手機號碼
                  <input value={adminForm.phone} onChange={(event) => updateAdminForm('phone', event.target.value)} placeholder="例如：0912345678" />
                </label>
                <label>
                  Email
                  <input value={adminForm.email} onChange={(event) => updateAdminForm('email', event.target.value)} placeholder="例如：ming@example.com" />
                </label>
                <label>
                  目標
                  <select value={adminForm.goal} onChange={(event) => updateAdminForm('goal', event.target.value)}>
                    <option>減脂 / 新手入門</option>
                    <option>增肌 / 重訓規劃</option>
                    <option>姿勢矯正 / 體態改善</option>
                    <option>團體課 / 體驗參觀</option>
                  </select>
                </label>
                <label>
                  偏好時段
                  <select value={adminForm.preferredSlot} onChange={(event) => updateAdminForm('preferredSlot', event.target.value)}>
                    <option>平日晚上</option>
                    <option>平日白天</option>
                    <option>週末上午</option>
                  </select>
                </label>
                <button className="submit-btn admin-create-btn" onClick={() => void submitAdminBooking()} disabled={busy}>
                  {busy ? '建立中...' : '新增預約'}
                </button>
              </div>
            </fieldset>
          </div>

          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <strong>{adminStats.total}</strong>
              <span>總預約數</span>
            </div>
            <div className="admin-stat-card">
              <strong>{adminStats.pending}</strong>
              <span>待回覆</span>
            </div>
            <div className="admin-stat-card">
              <strong>{adminStats.confirmed}</strong>
              <span>已確認</span>
            </div>
            <div className="admin-stat-card">
              <strong>{adminStats.completed}</strong>
              <span>已完成</span>
            </div>
          </div>

          <div className="crm-stats-grid">
            <div className="crm-stat-card">
              <strong>{crmStats.newLeads}</strong>
              <span>新名單</span>
            </div>
            <div className="crm-stat-card">
              <strong>{crmStats.contacted}</strong>
              <span>已聯繫</span>
            </div>
            <div className="crm-stat-card">
              <strong>{crmStats.trial}</strong>
              <span>已預約體驗</span>
            </div>
            <div className="crm-stat-card">
              <strong>{crmStats.won}</strong>
              <span>已成交</span>
            </div>
            <div className="crm-stat-card">
              <strong>{crmStats.lost}</strong>
              <span>流失</span>
            </div>
            <button className={`crm-stat-card crm-stat-action ${adminFollowUpOnly ? 'active' : ''}`} onClick={() => setAdminFollowUpOnly((prev) => !prev)}>
              <strong>{crmStats.followUpDue}</strong>
              <span>待追蹤</span>
            </button>
          </div>

          {healthSnapshot ? (
            <div className="section-card glass-card">
              <div className="section-heading compact">
                <div>
                  <p className="section-kicker">Admin Debug</p>
                  <h3>Live health / metrics snapshot</h3>
                </div>
                <p className="section-note">用來快速確認目前 API、validation 與 LINE webhook 狀態。</p>
              </div>
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <strong>{healthSnapshot.service}</strong>
                  <span>服務名稱</span>
                </div>
                <div className="admin-stat-card">
                  <strong>{healthSnapshot.db.bookings}</strong>
                  <span>DB bookings</span>
                </div>
                <div className="admin-stat-card">
                  <strong>{healthSnapshot.metrics?.chat.total ?? 0}</strong>
                  <span>chat requests</span>
                </div>
                <div className="admin-stat-card">
                  <strong>{healthSnapshot.metrics?.validation.total ?? 0}</strong>
                  <span>validation errors</span>
                </div>
              </div>
              <div className="feature-list slim">
                <div>
                  <strong>Chat fallback rate</strong>
                  <p>{healthSnapshot.metrics?.chat.fallbackRate ?? 0}</p>
                </div>
                <div>
                  <strong>Last validation route</strong>
                  <p>{healthSnapshot.metrics?.validation.lastRoute || '尚無資料'}</p>
                </div>
                <div>
                  <strong>LINE replies</strong>
                  <p>{healthSnapshot.metrics?.line.replies ?? 0}</p>
                </div>
                <div>
                  <strong>AI provider status</strong>
                  <p>OpenAI: {healthSnapshot.ai.configuredProviders.openai ? 'on' : 'off'} / Gemini: {healthSnapshot.ai.configuredProviders.gemini ? 'on' : 'off'}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="pipeline-board">
            {pipelineColumns.map((column) => (
              <div
                key={column.stage}
                className={`pipeline-column ${adminStage === column.stage ? 'active' : ''} ${dragStageTarget === column.stage ? 'drag-target' : ''}`}
                onDragOver={(event) => {
                  if (interactionLocked) return
                  event.preventDefault()
                  if (dragBookingKey) setDragStageTarget(column.stage)
                }}
                onDragLeave={() => {
                  if (dragStageTarget === column.stage) setDragStageTarget('')
                }}
                onDrop={(event) => {
                  if (interactionLocked) return
                  event.preventDefault()
                  const bookingKey = event.dataTransfer.getData('text/plain')
                  const targetBooking = filteredBookings.find((booking) => getBookingKey(booking) === bookingKey)
                  setDragStageTarget('')
                  if (targetBooking) {
                    void moveBookingToStage(targetBooking, column.stage)
                  }
                }}
              >
                <button
                  className="pipeline-column-header-btn"
                  onClick={() => setAdminStage((prev) => (prev === column.stage ? '全部階段' : column.stage))}
                >
                  <span className={`crm-pill stage-${column.stage}`}>{column.stage}</span>
                  <strong>{column.bookings.length}</strong>
                </button>
                <div className="pipeline-column-body">
                  {column.bookings.length > 0 ? (
                    column.bookings.slice(0, 4).map((booking) => {
                      const bookingKey = getBookingKey(booking)
                      const isDraggingCard = dragBookingKey === bookingKey
                      return (
                        <button
                          key={bookingKey}
                          className={`pipeline-mini-card ${isDraggingCard ? 'dragging' : ''}`}
                          draggable={!interactionLocked}
                          disabled={interactionLocked}
                          onDragStart={(event) => {
                            if (interactionLocked) {
                              event.preventDefault()
                              return
                            }
                            event.dataTransfer.setData('text/plain', bookingKey)
                            event.dataTransfer.effectAllowed = 'move'
                            setDragBookingKey(bookingKey)
                          }}
                          onDragEnd={() => {
                            setDragBookingKey('')
                            setDragStageTarget('')
                          }}
                          onClick={() => openBookingDetails(booking)}
                        >
                          <strong>{booking.name}</strong>
                          <span>{booking.className}</span>
                          <span>{booking.assignee}</span>
                        </button>
                      )
                    })
                  ) : (
                    <span className="pipeline-empty-text">目前沒有名單</span>
                  )}
                  {column.bookings.length > 4 ? <span className="pipeline-more-text">+{column.bookings.length - 4} 筆</span> : null}
                </div>
              </div>
            ))}
          </div>

          <fieldset className="control-fieldset" disabled={adminWriteLocked}>
            <div className="admin-toolbar admin-toolbar-crm">
              <input
                value={adminQuery}
                onChange={(event) => setAdminQuery(event.target.value)}
                placeholder="搜尋姓名 / 手機 / Email / 課程 / 負責人"
              />
              <select value={adminStatus} onChange={(event) => setAdminStatus(event.target.value as '全部' | BookingStatus)}>
                <option>全部</option>
                <option>待回覆</option>
                <option>已確認</option>
                <option>已完成</option>
              </select>
              <select value={adminStage} onChange={(event) => setAdminStage(event.target.value as '全部階段' | LeadStage)}>
                <option>全部階段</option>
                {stageOptions.map((stage) => (
                  <option key={stage}>{stage}</option>
                ))}
              </select>
              <select value={adminSource} onChange={(event) => setAdminSource(event.target.value as '全部來源' | LeadSource)}>
                <option>全部來源</option>
                {sourceOptions.map((source) => (
                  <option key={source}>{source}</option>
                ))}
              </select>
              <select value={adminTrainer} onChange={(event) => setAdminTrainer(event.target.value)}>
                {trainerOptions.map((trainer) => (
                  <option key={trainer}>{trainer}</option>
                ))}
              </select>
              <select value={adminClass} onChange={(event) => setAdminClass(event.target.value)}>
                {classOptions.map((className) => (
                  <option key={className}>{className}</option>
                ))}
              </select>
              <select value={adminAssignee} onChange={(event) => setAdminAssignee(event.target.value)}>
                {assigneeOptions.map((assignee) => (
                  <option key={assignee}>{assignee}</option>
                ))}
              </select>
              <select value={adminSort} onChange={(event) => setAdminSort(event.target.value as '最近更新' | '最早更新' | '預約時間新→舊' | '姓名 A-Z' | '追蹤時間近→遠')}>
                <option>最近更新</option>
                <option>最早更新</option>
                <option>預約時間新→舊</option>
                <option>追蹤時間近→遠</option>
                <option>姓名 A-Z</option>
              </select>
              <input type="date" value={adminStartDate} onChange={(event) => setAdminStartDate(event.target.value)} />
              <input type="date" value={adminEndDate} onChange={(event) => setAdminEndDate(event.target.value)} />
              <button className="secondary-btn admin-export-btn" onClick={exportBookingsCsv} disabled={filteredBookings.length === 0}>
                匯出 CSV
              </button>
              <button className="secondary-btn admin-overdue-btn" onClick={() => setAdminOverdueOnly((prev) => !prev)}>
                {adminOverdueOnly ? '顯示全部' : '逾期待處理'}
              </button>
              <button className="secondary-btn admin-overdue-btn" onClick={() => setAdminFollowUpOnly((prev) => !prev)}>
                {adminFollowUpOnly ? '全部名單' : '待追蹤'}
              </button>
              <button className="secondary-btn admin-selected-btn" onClick={() => setAdminSelectedOnly((prev) => !prev)} disabled={selectedBookingKeys.length === 0 && !adminSelectedOnly}>
                {adminSelectedOnly ? '顯示全部' : '只看已勾選'}
              </button>
              <button className="secondary-btn admin-clear-btn" onClick={resetAdminFilters} disabled={activeFilterLabels.length === 0}>
                清除篩選
              </button>
            </div>

            <div className="quick-filter-row">
              <button className="secondary-btn quick-filter-btn" onClick={applyTodayFilter}>
                今天
              </button>
              <button className="secondary-btn quick-filter-btn" onClick={applyThisWeekFilter}>
                本週
              </button>
              <button className="secondary-btn quick-filter-btn" onClick={() => setAdminStage('新名單')}>
                新名單
              </button>
              <button className="secondary-btn quick-filter-btn" onClick={() => setAdminStage('已聯繫')}>
                已聯繫
              </button>
              <button className="secondary-btn quick-filter-btn" onClick={resetAdminFilters}>
                清空全部
              </button>
            </div>
          </fieldset>

          {activeFilterLabels.length > 0 ? (
            <div className="active-filters">
              {activeFilterLabels.map((label) => (
                <span key={label} className="filter-chip">
                  {label}
                </span>
              ))}
            </div>
          ) : null}

          <div className="filtered-stats-grid">
            <div className="filtered-stat-card">
              <strong>{filteredAdminStats.total}</strong>
              <span>目前結果</span>
            </div>
            <button className={`filtered-stat-card stat-chip-btn ${adminStatus === '待回覆' ? 'active' : ''}`} onClick={() => setAdminStatus('待回覆')}>
              <strong>{filteredAdminStats.pending}</strong>
              <span>待回覆</span>
            </button>
            <button className={`filtered-stat-card stat-chip-btn ${adminStatus === '已確認' ? 'active' : ''}`} onClick={() => setAdminStatus('已確認')}>
              <strong>{filteredAdminStats.confirmed}</strong>
              <span>已確認</span>
            </button>
            <button className={`filtered-stat-card stat-chip-btn ${adminStatus === '已完成' ? 'active' : ''}`} onClick={() => setAdminStatus('已完成')}>
              <strong>{filteredAdminStats.completed}</strong>
              <span>已完成</span>
            </button>
          </div>

          <fieldset className="control-fieldset" disabled={adminWriteLocked}>
            <div className="batch-toolbar">
              <label className="batch-select-label">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectCurrentPage} />
                <span>本頁全選</span>
              </label>
              <button className="secondary-btn batch-mini-btn" onClick={selectAllFilteredBookings} disabled={filteredBookings.length === 0}>
                全選篩選結果
              </button>
              <button className="secondary-btn batch-mini-btn" onClick={clearSelectedBookings} disabled={selectedBookingKeys.length === 0}>
                清空勾選
              </button>
              <button className="secondary-btn batch-mini-btn" onClick={() => void copySelectedContacts('phone', '手機')} disabled={selectedBookingKeys.length === 0}>
                複製手機
              </button>
              <button className="secondary-btn batch-mini-btn" onClick={() => void copySelectedContacts('email', 'Email')} disabled={selectedBookingKeys.length === 0}>
                複製 Email
              </button>
              <span className="batch-count">已選 {selectedBookingKeys.length} 筆</span>
              <select value={batchStatus} onChange={(event) => setBatchStatus(event.target.value as BookingStatus)}>
                <option>待回覆</option>
                <option>已確認</option>
                <option>已完成</option>
              </select>
              <button className="secondary-btn batch-action-btn" onClick={() => void updateSelectedBookingsStatus()} disabled={busy || selectedBookingKeys.length === 0}>
                {busy ? '批次更新中...' : '批次改狀態'}
              </button>
              <select value={batchStage} onChange={(event) => setBatchStage(event.target.value as '不變' | LeadStage)}>
                <option>不變</option>
                {stageOptions.map((stage) => (
                  <option key={stage}>{stage}</option>
                ))}
              </select>
              <input
                value={batchAssignee}
                onChange={(event) => setBatchAssignee(event.target.value)}
                placeholder="批次指定負責人"
              />
              <button
                className="secondary-btn batch-action-btn"
                onClick={() => void updateSelectedBookingsCrm()}
                disabled={
                  busy ||
                  selectedBookingKeys.length === 0 ||
                  (batchStage === '不變' && !batchAssignee.trim())
                }
              >
                {busy ? '批次更新中...' : '批次改 CRM'}
              </button>
              <button className="secondary-btn batch-action-btn" onClick={exportSelectedBookingsCsv} disabled={selectedBookingKeys.length === 0}>
                匯出已勾選
              </button>
              <button className="danger-btn batch-action-btn" onClick={() => void deleteSelectedBookings()} disabled={busy || selectedBookingKeys.length === 0}>
                {busy ? '批次處理中...' : '批次刪除'}
              </button>
            </div>
          </fieldset>

          <div className="booking-table-shell">
            {loadingBookings ? (
              <div className="admin-loading-card">預約 / 名單資料載入中...</div>
            ) : filteredBookings.length > 0 ? (
              <>
                <div className="booking-table-meta">
                  <div className="booking-table-meta-group">
                    <span>
                      第 {safeAdminPage} / {totalAdminPages} 頁
                    </span>
                    <span>共 {filteredBookings.length} 筆</span>
                  </div>
                  <label className="page-size-label">
                    <span>每頁筆數</span>
                    <select value={adminPageSize} onChange={(event) => setAdminPageSize(Number(event.target.value) as 5 | 10 | 20)}>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                  </label>
                </div>

                <div className="booking-table-wrap">
                  <table className="booking-table booking-table-crm">
                    <thead>
                      <tr>
                        <th className="number-column">#</th>
                        <th className="checkbox-column">選取</th>
                        <th>
                          <button className="sort-header-btn" onClick={() => setAdminSort('姓名 A-Z')}>
                            姓名{getSortIndicator(adminSort === '姓名 A-Z')}
                          </button>
                        </th>
                        <th>CRM</th>
                        <th>課程 / 教練</th>
                        <th>聯絡方式</th>
                        <th>
                          <button className="sort-header-btn" onClick={() => setAdminSort('預約時間新→舊')}>
                            時間{getSortIndicator(adminSort === '預約時間新→舊')}
                          </button>
                        </th>
                        <th>
                          <button className="sort-header-btn" onClick={() => setAdminSort('追蹤時間近→遠')}>
                            下次追蹤{getSortIndicator(adminSort === '追蹤時間近→遠')}
                          </button>
                        </th>
                        <th>
                          <button
                            className="sort-header-btn"
                            onClick={() => setAdminSort((prev) => (prev === '最近更新' ? '最早更新' : '最近更新'))}
                          >
                            最後更新{getSortIndicator(adminSort === '最近更新' || adminSort === '最早更新')}
                          </button>
                        </th>
                        <th>狀態</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBookings.map((booking, index) => {
                        const bookingKey = `${booking.phone}-${booking.email}`
                        const isUpdating = updatingKey === bookingKey
                        const isSelectedRow = selectedBooking?.phone === booking.phone && selectedBooking?.email === booking.email
                        const isOverdueRow = isOverdueBooking(booking)
                        const isFollowUpRow = isFollowUpDue(booking.nextFollowUpAt)

                        return (
                          <tr
                            key={bookingKey}
                            className={`${isSelectedRow ? 'active-row ' : ''}${isOverdueRow ? 'overdue-row ' : ''}${isFollowUpRow ? 'followup-row ' : ''}${interactionLocked ? 'locked-row ' : ''}clickable-row`}
                            onClick={() => openBookingDetails(booking)}
                          >
                            <td className="number-column">{(safeAdminPage - 1) * adminPageSize + index + 1}</td>
                            <td className="checkbox-column">
                              <input
                                type="checkbox"
                                checked={selectedBookingKeys.includes(bookingKey)}
                                onClick={(event) => event.stopPropagation()}
                                onChange={() => toggleBookingSelection(booking)}
                              />
                            </td>
                            <td>
                              <strong>{booking.name}</strong>
                            </td>
                            <td>
                              <div className="booking-table-stack">
                                <span className={`crm-pill stage-${booking.stage}`}>{booking.stage}</span>
                                <span className="crm-source-text">{booking.source}</span>
                                <span>負責：{booking.assignee}</span>
                              </div>
                            </td>
                            <td>
                              <div className="booking-table-stack">
                                <strong>{booking.className}</strong>
                                <span>{booking.trainer}</span>
                                {booking.notes ? <span className="notes-preview" title={booking.notes}>備註：{booking.notes}</span> : null}
                              </div>
                            </td>
                            <td>
                              <div className="booking-table-stack">
                                <div className="contact-row">
                                  <span>{booking.phone}</span>
                                  <button className="mini-copy-btn" onClick={(event) => { event.stopPropagation(); void copyToClipboard('手機', booking.phone) }}>
                                    複製
                                  </button>
                                </div>
                                <div className="contact-row">
                                  <span>{booking.email}</span>
                                  <button className="mini-copy-btn" onClick={(event) => { event.stopPropagation(); void copyToClipboard('Email', booking.email) }}>
                                    複製
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td>{formatBookingDateLabel(booking.date)}</td>
                            <td>
                              <div className="booking-table-stack">
                                <span className={isFollowUpRow ? 'followup-due-text' : ''}>{formatFollowUpLabel(booking.nextFollowUpAt)}</span>
                                {isFollowUpRow ? <span className="followup-due-text">待處理</span> : null}
                              </div>
                            </td>
                            <td>{formatAuditTime(booking.updatedAt)}</td>
                            <td>
                              <div className="booking-table-stack">
                                <span className={`status-pill status-${booking.status}`}>{booking.status}</span>
                                <select
                                  value={booking.status}
                                  disabled={isUpdating}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) =>
                                    void changeBookingStatus(
                                      booking.phone,
                                      booking.email,
                                      event.target.value as BookingStatus,
                                    )
                                  }
                                >
                                  <option>待回覆</option>
                                  <option>已確認</option>
                                  <option>已完成</option>
                                </select>
                              </div>
                            </td>
                            <td>
                              <button
                                className="detail-link"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openBookingDetails(booking)
                                }}
                                disabled={interactionLocked && !isSelectedRow}
                              >
                                {isUpdating ? '更新中...' : '查看'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pagination-bar">
                  <button
                    className="secondary-btn pagination-btn"
                    onClick={() => setAdminPage((prev) => Math.max(1, prev - 1))}
                    disabled={safeAdminPage === 1}
                  >
                    上一頁
                  </button>
                  <button
                    className="secondary-btn pagination-btn"
                    onClick={() => setAdminPage((prev) => Math.min(totalAdminPages, prev + 1))}
                    disabled={safeAdminPage === totalAdminPages}
                  >
                    下一頁
                  </button>
                </div>
              </>
            ) : (
              <p className="empty-admin-state">目前沒有符合條件的預約。</p>
            )}
          </div>

          {selectedBooking ? (
            <div className="detail-panel">
              <div className="detail-panel-header">
                <div>
                  <p className="section-kicker">Booking / CRM Detail</p>
                  <h3>{detailForm.name || selectedBooking.name}</h3>
                  {hasUnsavedDetailChanges ? <p className="detail-dirty-hint">有未儲存變更</p> : null}
                  <p className="detail-shortcut-hint">快捷鍵：Ctrl/Cmd + S 儲存，Esc 關閉</p>
                </div>
                <div className="detail-header-actions">
                  <button
                    className="detail-close"
                    onClick={() => {
                      if (!previousBooking || !confirmLeaveDirtyDetail()) return
                      setSelectedBooking(previousBooking)
                    }}
                    disabled={!previousBooking || detailSaving || detailDeleting}
                  >
                    上一筆
                  </button>
                  <button
                    className="detail-close"
                    onClick={() => {
                      if (!nextBooking || !confirmLeaveDirtyDetail()) return
                      setSelectedBooking(nextBooking)
                    }}
                    disabled={!nextBooking || detailSaving || detailDeleting}
                  >
                    下一筆
                  </button>
                  <button
                    className="detail-close"
                    onClick={() => {
                      if (!confirmLeaveDirtyDetail()) return
                      setSelectedBooking(null)
                      setError('')
                    }}
                    disabled={detailSaving || detailDeleting}
                  >
                    關閉
                  </button>
                </div>
              </div>

              <fieldset className="control-fieldset detail-fieldset" disabled={detailFormLocked}>
                <div className="detail-grid">
                <label className="detail-field">
                  <span>狀態</span>
                  <select
                    value={selectedBooking.status}
                    disabled={detailSaving || updatingKey === `${selectedBooking.phone}-${selectedBooking.email}`}
                    onChange={(event) =>
                      void changeBookingStatus(
                        selectedBooking.phone,
                        selectedBooking.email,
                        event.target.value as BookingStatus,
                      )
                    }
                  >
                    <option>待回覆</option>
                    <option>已確認</option>
                    <option>已完成</option>
                  </select>
                  <div className="quick-status-actions">
                    <button
                      className="secondary-btn quick-status-btn"
                      onClick={() => void changeBookingStatus(selectedBooking.phone, selectedBooking.email, '待回覆')}
                      disabled={detailSaving || detailDeleting || selectedBooking.status === '待回覆'}
                    >
                      標記待回覆
                    </button>
                    <button
                      className="secondary-btn quick-status-btn"
                      onClick={() => void changeBookingStatus(selectedBooking.phone, selectedBooking.email, '已確認')}
                      disabled={detailSaving || detailDeleting || selectedBooking.status === '已確認'}
                    >
                      標記已確認
                    </button>
                    <button
                      className="secondary-btn quick-status-btn"
                      onClick={() => void changeBookingStatus(selectedBooking.phone, selectedBooking.email, '已完成')}
                      disabled={detailSaving || detailDeleting || selectedBooking.status === '已完成'}
                    >
                      標記已完成
                    </button>
                  </div>
                </label>
                <div>
                  <span>手機</span>
                  <strong>{selectedBooking.phone}</strong>
                  <button className="mini-copy-btn" onClick={() => void copyToClipboard('手機', selectedBooking.phone)}>
                    複製手機
                  </button>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{selectedBooking.email}</strong>
                  <button className="mini-copy-btn" onClick={() => void copyToClipboard('Email', selectedBooking.email)}>
                    複製 Email
                  </button>
                </div>
                <div>
                  <span>建立時間</span>
                  <strong>{formatAuditTime(selectedBooking.createdAt)}</strong>
                </div>
                <div>
                  <span>最後更新</span>
                  <strong>{formatAuditTime(selectedBooking.updatedAt)}</strong>
                </div>
                <label className="detail-field">
                  <span>名單階段</span>
                  <select value={detailForm.stage} onChange={(event) => updateDetailForm('stage', event.target.value as LeadStage)}>
                    {stageOptions.map((stage) => (
                      <option key={stage}>{stage}</option>
                    ))}
                  </select>
                  <div className="quick-stage-actions">
                    {stageOptions.map((stage) => (
                      <button
                        key={stage}
                        className="secondary-btn quick-stage-btn"
                        onClick={() => updateDetailForm('stage', stage)}
                        disabled={detailForm.stage === stage}
                      >
                        {stage}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="detail-field">
                  <span>來源</span>
                  <select value={detailForm.source} onChange={(event) => updateDetailForm('source', event.target.value as LeadSource)}>
                    {sourceOptions.map((source) => (
                      <option key={source}>{source}</option>
                    ))}
                  </select>
                </label>
                <label className="detail-field">
                  <span>負責人</span>
                  <input
                    value={detailForm.assignee}
                    onChange={(event) => updateDetailForm('assignee', event.target.value)}
                    placeholder="例如：Nina"
                  />
                </label>
                <label className="detail-field">
                  <span>下次追蹤</span>
                  <input
                    type="datetime-local"
                    value={detailForm.nextFollowUpAt}
                    onChange={(event) => updateDetailForm('nextFollowUpAt', event.target.value)}
                  />
                  <div className="followup-quick-actions">
                    <button className="secondary-btn note-template-btn" onClick={() => scheduleFollowUp(24)}>
                      +24h
                    </button>
                    <button className="secondary-btn note-template-btn" onClick={() => scheduleFollowUp(72)}>
                      +3天
                    </button>
                    <button className="secondary-btn note-template-btn" onClick={() => updateDetailForm('nextFollowUpAt', '')}>
                      清除
                    </button>
                  </div>
                </label>
                <label className="detail-field">
                  <span>姓名</span>
                  <input
                    value={detailForm.name}
                    onChange={(event) => updateDetailForm('name', event.target.value)}
                    placeholder="例如：王小美"
                  />
                </label>
                <label className="detail-field">
                  <span>課程</span>
                  <input
                    value={detailForm.className}
                    onChange={(event) => updateDetailForm('className', event.target.value)}
                    placeholder="例如：新手燃脂體驗課"
                  />
                </label>
                <label className="detail-field">
                  <span>教練</span>
                  <input
                    value={detailForm.trainer}
                    onChange={(event) => updateDetailForm('trainer', event.target.value)}
                    placeholder="例如：Coach Aiden"
                  />
                </label>
                <label className="detail-field">
                  <span>預約時間</span>
                  <input
                    type="datetime-local"
                    value={toDateTimeInputValue(detailForm.date)}
                    onChange={(event) => updateDetailForm('date', fromDateTimeInputValue(event.target.value))}
                  />
                  <small className="detail-help">儲存格式會自動轉成 YYYY/MM/DD HH:mm</small>
                </label>
                <label className="detail-field detail-field-wide">
                  <span>內部備註</span>
                  <div className="note-template-row">
                    <button className="secondary-btn note-template-btn" onClick={() => appendNoteTemplate('已電話確認')}>
                      已電話確認
                    </button>
                    <button className="secondary-btn note-template-btn" onClick={() => appendNoteTemplate('客戶想改期，待回覆新時段')}>
                      改期需求
                    </button>
                    <button className="secondary-btn note-template-btn" onClick={() => appendNoteTemplate('可列入回訪名單')}>
                      回訪名單
                    </button>
                    <button className="secondary-btn note-template-btn" onClick={() => appendNoteTemplate('已加 LINE，待傳報價')}>
                      傳報價
                    </button>
                  </div>
                  <textarea
                    value={detailForm.notes}
                    onChange={(event) => updateDetailForm('notes', event.target.value)}
                    placeholder="例如：已電話確認、偏好晚間時段、可作為回訪名單"
                    rows={4}
                  />
                </label>
                <div className="detail-field detail-field-wide activity-log-panel">
                  <span>聯絡 / 跟進紀錄</span>
                  <div className="note-template-row">
                    <button className="secondary-btn note-template-btn" onClick={() => appendActivityLogTemplate('已電話聯繫，待回覆')}>
                      電話聯繫
                    </button>
                    <button className="secondary-btn note-template-btn" onClick={() => appendActivityLogTemplate('已加 LINE，待傳方案')}>
                      已加 LINE
                    </button>
                    <button className="secondary-btn note-template-btn" onClick={() => appendActivityLogTemplate('已傳報價，待確認體驗時間')}>
                      已傳報價
                    </button>
                    <button className="secondary-btn note-template-btn" onClick={() => appendActivityLogTemplate('客戶暫不考慮，列入回訪名單')}>
                      列回訪
                    </button>
                  </div>
                  <div className="activity-draft-row">
                    <input
                      value={activityDraft}
                      onChange={(event) => setActivityDraft(event.target.value)}
                      placeholder="新增一筆聯絡紀錄，例如：2026 春季活動方案已傳送"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addActivityLogEntry()
                        }
                      }}
                    />
                    <button className="secondary-btn activity-add-btn" onClick={addActivityLogEntry}>
                      新增紀錄
                    </button>
                  </div>
                  {detailForm.activityLog.length > 0 ? (
                    <div className="activity-log-list">
                      {detailForm.activityLog.map((entry, index) => (
                        <div key={`${entry}-${index}`} className="activity-log-item">
                          <p>{entry}</p>
                          <button className="mini-copy-btn" onClick={() => removeActivityLogEntry(index)}>
                            刪除
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="activity-empty-text">還沒有聯絡紀錄，可以先用上面的快捷按鈕補第一筆。</p>
                  )}
                </div>
                </div>
              </fieldset>

              <div className="detail-actions">
                <button
                  className="danger-btn detail-action-btn"
                  onClick={() => void deleteSelectedBooking()}
                  disabled={detailSaving || detailDeleting}
                >
                  {detailDeleting ? '刪除中...' : '刪除預約'}
                </button>
                <button
                  className="secondary-btn detail-action-btn"
                  onClick={() => {
                    setDetailForm({
                      name: selectedBooking.name,
                      className: selectedBooking.className,
                      trainer: selectedBooking.trainer,
                      date: selectedBooking.date,
                      notes: selectedBooking.notes,
                      stage: selectedBooking.stage,
                      source: selectedBooking.source,
                      assignee: selectedBooking.assignee,
                      nextFollowUpAt: selectedBooking.nextFollowUpAt,
                      activityLog: selectedBooking.activityLog,
                    })
                    setActivityDraft('')
                  }}
                  disabled={detailSaving || detailDeleting || !hasUnsavedDetailChanges}
                >
                  重設
                </button>
                <button
                  className="submit-btn detail-action-btn"
                  onClick={() => void saveBookingDetails()}
                  disabled={detailSaving || detailDeleting || !hasUnsavedDetailChanges}
                >
                  {detailSaving ? '儲存中...' : '儲存明細'}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </main>

      <footer className="footer glass-card">
        <div>
          <strong>PulseFit AI</strong>
          <p>Deployable front-end MVP for gym concierge, booking lookup, lead capture, and CRM follow-up.</p>
        </div>
        <div className="footer-meta">
          <span>API mode: {apiModeLabel}</span>
          <span>Ready for Vercel / Netlify</span>
        </div>
      </footer>
    </div>
  )
}

export default App
