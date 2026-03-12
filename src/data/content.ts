import type { FAQItem, Plan, Testimonial, BookingRecord } from '../types'

export const storageKey = 'ai-gym-updated-bookings'

export const faqItems: FAQItem[] = [
  {
    question: '你們提供哪些服務？',
    answer:
      '提供一對一教練課、團體課、體態評估、飲食建議與會員方案介紹。這個版本先以展示 AI 預約機器人的接待流程為主。',
  },
  {
    question: '可以先體驗再決定嗎？',
    answer:
      '可以。訪客可透過聊天入口留下需求，系統會推薦體驗課、安排時段，並在 demo 模式下建立預約紀錄。',
  },
  {
    question: '查詢預約需要什麼資料？',
    answer: '目前 MVP 採用手機號碼 + Email 組合查詢，方便現場 demo 與客服核對。',
  },
  {
    question: 'AI 可以做什麼？',
    answer:
      'AI 會先做需求分流：回答 FAQ、推薦課程、收集聯絡資訊、引導預約與查詢訂單。正式版可再串接真正的 LLM 與 CRM。',
  },
]

export const seedBookingRecords: BookingRecord[] = [
  {
    name: '王小美',
    phone: '0912345678',
    email: 'amy.demo@example.com',
    className: '新手燃脂體驗課',
    trainer: 'Coach Aiden',
    date: '2026/03/18 19:00',
    status: '已確認',
    notes: '已完成初步體驗課確認，可追蹤轉正式會員。',
  },
  {
    name: '陳志豪',
    phone: '0987654321',
    email: 'leo.demo@example.com',
    className: '增肌訓練諮詢',
    trainer: 'Coach Vera',
    date: '2026/03/19 14:30',
    status: '待回覆',
    notes: '偏好下午時段，對重訓課表很有興趣。',
  },
  {
    name: '林佩琪',
    phone: '0955667788',
    email: 'peggy.demo@example.com',
    className: '團體核心課',
    trainer: 'Coach Max',
    date: '2026/03/12 20:00',
    status: '已完成',
    notes: '已完成體驗，可作為回訪名單。',
  },
]

export const plans: Plan[] = [
  {
    name: '體驗課',
    price: 'NT$ 699',
    description: '第一次接觸健身房或想了解教練課流程的最佳入口。',
    features: ['60 分鐘體驗', '基礎體態評估', 'AI 預約導流'],
  },
  {
    name: '月會籍',
    price: 'NT$ 2,680 / 月',
    highlight: true,
    description: '適合已經準備固定訓練的會員，含基本課表建議與客服支援。',
    features: ['不限次進場', '團體課折扣', 'FAQ / 客服自動分流'],
  },
  {
    name: '私人教練方案',
    price: 'NT$ 12,800 起',
    description: '針對減脂、增肌、姿勢矯正或備賽需求的高接觸服務。',
    features: ['一對一教練', '進度追蹤', '正式版可接 CRM'],
  },
]

export const testimonials: Testimonial[] = [
  {
    name: 'Mina / 體驗課學員',
    quote: '以前我每次要私訊問課表都很慢，現在用 AI 先分流，體驗課安排快很多。',
  },
  {
    name: 'Jason / 健身房營運',
    quote: '這種 demo 很適合拿給老闆看，因為一眼就能理解 AI 到底能幫前台省多少時間。',
  },
  {
    name: 'Tina / 客服',
    quote: 'FAQ 與預約查詢先自助完成，真的能減少重複回答。',
  },
]

export const quickReplies = [
  '我想了解會員方案',
  '幫我推薦適合新手的課',
  '我想查詢預約',
]
