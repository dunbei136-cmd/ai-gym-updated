import './App.css'
import { useEffect, useMemo, useState } from 'react'
import { faqItems, plans, quickReplies, testimonials } from './data/content'
import { api, apiModeLabel } from './lib/api'
import type { BookingDetailPatch, BookingRecord, ChatMessage, LeadForm } from './types'

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

function App() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '歡迎來到 PulseFit AI。你可以直接問我課程、費用、體驗流程，或用下方功能查詢預約。',
    },
  ])
  const [chatInput, setChatInput] = useState('')
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
  const [adminForm, setAdminForm] = useState<LeadForm>({
    name: '',
    phone: '',
    email: '',
    goal: '減脂 / 新手入門',
    preferredSlot: '平日晚上',
  })
  const [bookings, setBookings] = useState<BookingRecord[]>([])
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
  })
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailDeleting, setDetailDeleting] = useState(false)
  const [adminQuery, setAdminQuery] = useState('')
  const [adminStatus, setAdminStatus] = useState<'全部' | '待回覆' | '已確認' | '已完成'>('全部')
  const [adminSort, setAdminSort] = useState<'最新優先' | '最舊優先' | '姓名 A-Z'>('最新優先')
  const [adminStartDate, setAdminStartDate] = useState('')
  const [adminEndDate, setAdminEndDate] = useState('')
  const [adminPage, setAdminPage] = useState(1)
  const [adminPageSize, setAdminPageSize] = useState<5 | 10 | 20>(5)
  const [selectedBookingKeys, setSelectedBookingKeys] = useState<string[]>([])
  const [batchStatus, setBatchStatus] = useState<BookingRecord['status']>('待回覆')

  useEffect(() => {
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
    })
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

  const filteredBookings = useMemo(() => {
    const filtered = bookings.filter((booking) => {
      const matchStatus = adminStatus === '全部' ? true : booking.status === adminStatus
      const keyword = adminQuery.trim().toLowerCase()
      const matchKeyword =
        !keyword ||
        booking.name.toLowerCase().includes(keyword) ||
        booking.phone.includes(keyword) ||
        booking.email.toLowerCase().includes(keyword) ||
        booking.className.toLowerCase().includes(keyword)

      const bookingDateOnly = getBookingDateOnly(booking.date)
      const matchStartDate = !adminStartDate || (bookingDateOnly && bookingDateOnly >= adminStartDate)
      const matchEndDate = !adminEndDate || (bookingDateOnly && bookingDateOnly <= adminEndDate)

      return matchStatus && matchKeyword && matchStartDate && matchEndDate
    })

    const sorted = [...filtered]

    if (adminSort === '姓名 A-Z') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
      return sorted
    }

    sorted.sort((a, b) => a.date.localeCompare(b.date))
    return adminSort === '最舊優先' ? sorted : sorted.reverse()
  }, [adminEndDate, adminQuery, adminSort, adminStartDate, adminStatus, bookings])

  useEffect(() => {
    setAdminPage(1)
  }, [adminEndDate, adminPageSize, adminQuery, adminSort, adminStartDate, adminStatus])

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
    adminSort !== '最新優先' ? `排序：${adminSort}` : '',
    adminStartDate ? `開始：${adminStartDate}` : '',
    adminEndDate ? `結束：${adminEndDate}` : '',
  ].filter(Boolean)

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

  const sendMessage = async (value?: string) => {
    const message = (value ?? chatInput).trim()
    if (!message) return

    const userMessage: ChatMessage = { role: 'user', content: message }
    setChatMessages((prev) => [...prev, userMessage])
    setChatInput('')

    try {
      const reply = await api.sendChat(message)
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }])
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
      setNotice(`已建立 ${booking.name} 的 booking`)
    } catch {
      setError('建立預約失敗，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

  const submitAdminBooking = async () => {
    if (!adminForm.name.trim() || !adminForm.phone.trim() || !adminForm.email.trim()) {
      setError('Admin 新增 booking 時，姓名、手機與 Email 都要填寫')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')

    try {
      const booking = await api.createBooking(adminForm)
      const nextBookings = await api.listBookings()
      setBookings(nextBookings)
      setSelectedBooking(booking)
      setAdminStatus('全部')
      setAdminQuery('')
      setAdminForm({
        name: '',
        phone: '',
        email: '',
        goal: '減脂 / 新手入門',
        preferredSlot: '平日晚上',
      })
      setNotice(`Admin 已建立 ${booking.name} 的 booking`)
    } catch {
      setError('Admin 建立 booking 失敗，請稍後再試')
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
    setAdminSort('最新優先')
    setAdminStartDate('')
    setAdminEndDate('')
    setAdminPage(1)
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

  const exportBookingsCsv = () => {
    const rows = [
      ['姓名', '手機', 'Email', '課程', '教練', '預約時間', '狀態'],
      ...filteredBookings.map((booking) => [
        booking.name,
        booking.phone,
        booking.email,
        booking.className,
        booking.trainer,
        booking.date,
        booking.status,
      ]),
    ]

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pulsefit-bookings-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const changeBookingStatus = async (
    phone: string,
    email: string,
    status: BookingRecord['status'],
  ) => {
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
      setNotice(`已批次更新 ${targets.length} 筆 booking 為 ${batchStatus}`)
    } catch {
      setError('批次更新狀態失敗，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

  const deleteSelectedBookings = async () => {
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

  const saveBookingDetails = async () => {
    if (!selectedBooking) return

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
      })
      const nextBookings = await api.listBookings()
      setBookings(nextBookings)
      setSelectedBooking(updated)

      if (lookupResult && lookupResult.phone === updated.phone && lookupResult.email === updated.email) {
        setLookupResult(updated)
      }

      setNotice(`已儲存 ${updated.name} 的 booking 明細`)
    } catch {
      setError('更新 booking 明細失敗，請稍後再試')
    } finally {
      setDetailSaving(false)
    }
  }

  const deleteSelectedBooking = async () => {
    if (!selectedBooking) return

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
          <h1>把健身房的接待、導流與預約查詢做成一個真的能 demo 的產品。</h1>
          <p className="hero-text">
            這不是只有視覺稿。現在這版已經有品牌化首頁、聊天入口、FAQ、方案展示、預約建立、查詢結果，以及可切換的 API layer。
          </p>
          <div className="hero-actions">
            <a href="#lead-capture" className="primary-btn">
              立即體驗預約流程
            </a>
            <a href="#booking-lookup" className="secondary-btn">
              查看 Booking Lookup
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
            <li>之後可直接接 CRM / LINE / 真實後端</li>
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
                <p>使用者可留下需求，系統立即產生一筆可查詢的 booking。</p>
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
                <p>未來只要補後端服務與 webhook，就能延伸成正式產品。</p>
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
                  <button key={reply} className="chip" onClick={() => void sendMessage(reply)}>
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
                <button onClick={() => void sendMessage()}>送出</button>
              </div>
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
                  <span className="status-pill">{lookupResult.status}</span>
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
                  <p>你現在可以直接到上方 Booking Lookup 查這筆資料。</p>
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
              <h2>預約後台頁</h2>
            </div>
            <p className="section-note">直接讀 API booking 清單，帶搜尋、篩選與狀態總覽。</p>
          </div>

          {error ? <p className="error-text admin-feedback">{error}</p> : null}
          {notice ? <p className="notice-text admin-feedback">{notice}</p> : null}

          <div className="admin-create-panel">
            <div className="section-heading compact">
              <div>
                <p className="section-kicker">Quick Create</p>
                <h3>後台直接新增 booking</h3>
              </div>
              <p className="section-note">用 admin 角度快速建立資料，建立後會自動選中這筆 booking。</p>
            </div>

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
                {busy ? '建立中...' : '新增 booking'}
              </button>
            </div>
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

          <div className="admin-toolbar">
            <input
              value={adminQuery}
              onChange={(event) => setAdminQuery(event.target.value)}
              placeholder="搜尋姓名 / 手機 / Email / 課程"
            />
            <select value={adminStatus} onChange={(event) => setAdminStatus(event.target.value as '全部' | '待回覆' | '已確認' | '已完成')}>
              <option>全部</option>
              <option>待回覆</option>
              <option>已確認</option>
              <option>已完成</option>
            </select>
            <select value={adminSort} onChange={(event) => setAdminSort(event.target.value as '最新優先' | '最舊優先' | '姓名 A-Z')}>
              <option>最新優先</option>
              <option>最舊優先</option>
              <option>姓名 A-Z</option>
            </select>
            <input type="date" value={adminStartDate} onChange={(event) => setAdminStartDate(event.target.value)} />
            <input type="date" value={adminEndDate} onChange={(event) => setAdminEndDate(event.target.value)} />
            <button className="secondary-btn admin-export-btn" onClick={exportBookingsCsv} disabled={filteredBookings.length === 0}>
              匯出 CSV
            </button>
            <button className="secondary-btn admin-clear-btn" onClick={resetAdminFilters} disabled={activeFilterLabels.length === 0}>
              清除篩選
            </button>
          </div>

          {activeFilterLabels.length > 0 ? (
            <div className="active-filters">
              {activeFilterLabels.map((label) => (
                <span key={label} className="filter-chip">
                  {label}
                </span>
              ))}
            </div>
          ) : null}

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
            <span className="batch-count">已選 {selectedBookingKeys.length} 筆</span>
            <select value={batchStatus} onChange={(event) => setBatchStatus(event.target.value as BookingRecord['status'])}>
              <option>待回覆</option>
              <option>已確認</option>
              <option>已完成</option>
            </select>
            <button className="secondary-btn batch-action-btn" onClick={() => void updateSelectedBookingsStatus()} disabled={busy || selectedBookingKeys.length === 0}>
              {busy ? '批次更新中...' : '批次改狀態'}
            </button>
            <button className="danger-btn batch-action-btn" onClick={() => void deleteSelectedBookings()} disabled={busy || selectedBookingKeys.length === 0}>
              {busy ? '批次處理中...' : '批次刪除'}
            </button>
          </div>

          <div className="booking-table-shell">
            {loadingBookings ? (
              <div className="admin-loading-card">booking 資料載入中...</div>
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
                  <table className="booking-table">
                    <thead>
                      <tr>
                        <th className="number-column">#</th>
                        <th className="checkbox-column">選取</th>
                        <th>姓名</th>
                        <th>課程 / 教練</th>
                        <th>聯絡方式</th>
                        <th>時間</th>
                        <th>狀態</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedBookings.map((booking, index) => {
                        const bookingKey = `${booking.phone}-${booking.email}`
                        const isUpdating = updatingKey === bookingKey
                        const isSelectedRow = selectedBooking?.phone === booking.phone && selectedBooking?.email === booking.email

                        return (
                          <tr key={bookingKey} className={isSelectedRow ? 'active-row' : ''}>
                            <td className="number-column">{(safeAdminPage - 1) * adminPageSize + index + 1}</td>
                            <td className="checkbox-column">
                              <input
                                type="checkbox"
                                checked={selectedBookingKeys.includes(bookingKey)}
                                onChange={() => toggleBookingSelection(booking)}
                              />
                            </td>
                            <td>
                              <strong>{booking.name}</strong>
                            </td>
                            <td>
                              <div className="booking-table-stack">
                                <strong>{booking.className}</strong>
                                <span>{booking.trainer}</span>
                              </div>
                            </td>
                            <td>
                              <div className="booking-table-stack">
                                <div className="contact-row">
                                  <span>{booking.phone}</span>
                                  <button className="mini-copy-btn" onClick={() => void copyToClipboard('手機', booking.phone)}>
                                    複製
                                  </button>
                                </div>
                                <div className="contact-row">
                                  <span>{booking.email}</span>
                                  <button className="mini-copy-btn" onClick={() => void copyToClipboard('Email', booking.email)}>
                                    複製
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td>{formatBookingDateLabel(booking.date)}</td>
                            <td>
                              <select
                                value={booking.status}
                                disabled={isUpdating}
                                onChange={(event) =>
                                  void changeBookingStatus(
                                    booking.phone,
                                    booking.email,
                                    event.target.value as BookingRecord['status'],
                                  )
                                }
                              >
                                <option>待回覆</option>
                                <option>已確認</option>
                                <option>已完成</option>
                              </select>
                            </td>
                            <td>
                              <button
                                className="detail-link"
                                onClick={() => {
                                  setSelectedBooking(booking)
                                  setError('')
                                }}
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
                  <p className="section-kicker">Booking Detail</p>
                  <h3>{detailForm.name || selectedBooking.name}</h3>
                </div>
                <div className="detail-header-actions">
                  <button
                    className="detail-close"
                    onClick={() => previousBooking && setSelectedBooking(previousBooking)}
                    disabled={!previousBooking || detailSaving || detailDeleting}
                  >
                    上一筆
                  </button>
                  <button
                    className="detail-close"
                    onClick={() => nextBooking && setSelectedBooking(nextBooking)}
                    disabled={!nextBooking || detailSaving || detailDeleting}
                  >
                    下一筆
                  </button>
                  <button
                    className="detail-close"
                    onClick={() => {
                      setSelectedBooking(null)
                      setError('')
                    }}
                    disabled={detailSaving || detailDeleting}
                  >
                    關閉
                  </button>
                </div>
              </div>

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
                        event.target.value as BookingRecord['status'],
                      )
                    }
                  >
                    <option>待回覆</option>
                    <option>已確認</option>
                    <option>已完成</option>
                  </select>
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
              </div>

              <div className="detail-actions">
                <button
                  className="danger-btn detail-action-btn"
                  onClick={() => void deleteSelectedBooking()}
                  disabled={detailSaving || detailDeleting}
                >
                  {detailDeleting ? '刪除中...' : '刪除 booking'}
                </button>
                <button
                  className="secondary-btn detail-action-btn"
                  onClick={() =>
                    setDetailForm({
                      name: selectedBooking.name,
                      className: selectedBooking.className,
                      trainer: selectedBooking.trainer,
                      date: selectedBooking.date,
                    })
                  }
                  disabled={detailSaving || detailDeleting}
                >
                  重設
                </button>
                <button
                  className="submit-btn detail-action-btn"
                  onClick={() => void saveBookingDetails()}
                  disabled={detailSaving || detailDeleting}
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
          <p>Deployable front-end MVP for gym concierge, FAQ, booking lookup, and lead capture.</p>
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
