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
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [lookupResult, setLookupResult] = useState<BookingRecord | null>(null)
  const [lookupTouched, setLookupTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [updatingKey, setUpdatingKey] = useState('')
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null)
  const [detailForm, setDetailForm] = useState<BookingDetailPatch>({
    name: '',
    className: '',
    trainer: '',
    date: '',
  })
  const [detailSaving, setDetailSaving] = useState(false)
  const [adminQuery, setAdminQuery] = useState('')
  const [adminStatus, setAdminStatus] = useState<'全部' | '待回覆' | '已確認' | '已完成'>('全部')

  useEffect(() => {
    void api.listBookings().then(setBookings).catch(() => setError('載入 booking 資料失敗'))
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
    return bookings.filter((booking) => {
      const matchStatus = adminStatus === '全部' ? true : booking.status === adminStatus
      const keyword = adminQuery.trim().toLowerCase()
      const matchKeyword =
        !keyword ||
        booking.name.toLowerCase().includes(keyword) ||
        booking.phone.includes(keyword) ||
        booking.email.toLowerCase().includes(keyword) ||
        booking.className.toLowerCase().includes(keyword)

      return matchStatus && matchKeyword
    })
  }, [adminQuery, adminStatus, bookings])

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

  const submitLead = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      setError('請至少填寫姓名、手機與 Email')
      return
    }

    setBusy(true)
    setError('')

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
    } catch {
      setError('建立預約失敗，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

  const changeBookingStatus = async (
    phone: string,
    email: string,
    status: BookingRecord['status'],
  ) => {
    const key = `${phone}-${email}`
    setUpdatingKey(key)
    setError('')

    try {
      const updated = await api.updateBookingStatus(phone, email, status)
      const nextBookings = await api.listBookings()
      setBookings(nextBookings)

      if (lookupResult && lookupResult.phone === updated.phone && lookupResult.email === updated.email) {
        setLookupResult(updated)
      }
    } catch {
      setError('更新狀態失敗，請稍後再試')
    } finally {
      setUpdatingKey('')
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
    } catch {
      setError('更新 booking 明細失敗，請稍後再試')
    } finally {
      setDetailSaving(false)
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
          </div>

          <div className="booking-list">
            {filteredBookings.map((booking) => {
              const bookingKey = `${booking.phone}-${booking.email}`
              const isUpdating = updatingKey === bookingKey

              return (
                <article key={bookingKey} className="booking-list-item">
                  <div>
                    <strong>{booking.name}</strong>
                    <p>
                      {booking.className} · {booking.trainer}
                    </p>
                    <button
                      className="detail-link"
                      onClick={() => {
                        setSelectedBooking(booking)
                        setError('')
                      }}
                    >
                      查看明細
                    </button>
                  </div>
                  <div className="booking-list-actions">
                    <span className="status-pill">{booking.status}</span>
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
                    <p>{isUpdating ? '更新中...' : `${booking.phone} / ${booking.email}`}</p>
                    <p>{formatBookingDateLabel(booking.date)}</p>
                  </div>
                </article>
              )
            })}
            {filteredBookings.length === 0 ? <p className="empty-admin-state">目前沒有符合條件的預約。</p> : null}
          </div>

          {selectedBooking ? (
            <div className="detail-panel">
              <div className="detail-panel-header">
                <div>
                  <p className="section-kicker">Booking Detail</p>
                  <h3>{detailForm.name || selectedBooking.name}</h3>
                </div>
                <button
                  className="detail-close"
                  onClick={() => {
                    setSelectedBooking(null)
                    setError('')
                  }}
                >
                  關閉
                </button>
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
                </div>
                <div>
                  <span>Email</span>
                  <strong>{selectedBooking.email}</strong>
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
                  className="secondary-btn detail-action-btn"
                  onClick={() =>
                    setDetailForm({
                      name: selectedBooking.name,
                      className: selectedBooking.className,
                      trainer: selectedBooking.trainer,
                      date: selectedBooking.date,
                    })
                  }
                  disabled={detailSaving}
                >
                  重設
                </button>
                <button className="submit-btn detail-action-btn" onClick={() => void saveBookingDetails()} disabled={detailSaving}>
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
