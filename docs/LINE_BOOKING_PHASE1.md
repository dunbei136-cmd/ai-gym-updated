# LINE Booking Integration — Phase 1

## 目標

讓客人可以從 LINE 發訊息進來，系統能：

- 接收 LINE webhook
- 做最小可用的預約導流對話
- 建立 booking / lead
- 在 CRM 後台標記來源為 `LINE`
- 回覆使用者基本預約結果

---

## Phase 1 範圍

### 使用者流程

1. 客人在 LINE 官方帳號發訊息
2. webhook 收到訊息
3. 系統判斷是否為預約意圖 / 查詢意圖
4. 若是預約：蒐集姓名、手機、Email、需求、偏好時段
5. 建立 booking / lead
6. 回覆「已收到預約需求」與後續指引

### 後台流程

- 新資料寫進 booking / CRM
- `source = LINE`
- activity log 記錄來自 LINE 的建立事件

---

## 建議技術拆解

### 1. Webhook endpoint
- 新增 `/integrations/line/webhook`
- 驗證 LINE signature
- 解析 message event

### 2. Session / state
- 需要最小會話狀態
- 記住使用者目前正在回答哪個欄位
- Phase 1 可先用 memory / sqlite 簡單存

### 3. Intent routing
- 預約
- 查詢
- 一般 FAQ

### 4. Booking write path
- 用既有 booking 建立流程
- 寫入 `source = LINE`
- activity log 補一筆「LINE 建立名單」

### 5. LINE reply
- 回覆收集問題
- 回覆完成結果
- 回覆查詢指引

---

## 需要新增的後端模組

### `server/integrations/line.mjs`
建議職責：
- signature 驗證
- webhook event parsing
- reply message formatting

### `server/line-session.mjs`（可另命名）
建議職責：
- LINE user state machine
- 暫存表單欄位

---

## Phase 1 最小蒐集欄位

- 姓名
- 手機
- Email
- 目標（減脂 / 增肌 / 體態 / 團課）
- 偏好時段

---

## API / 資料需求

### 需要的環境變數
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`

### 建議的 activity log
- `LINE webhook 建立名單`
- `LINE 使用者完成預約資料填寫`

---

## 驗收條件

- LINE 訊息可成功進站
- 預約對話可完成基本欄位蒐集
- booking 能成功建立
- CRM 來源顯示 `LINE`
- activity log 有 LINE 建立紀錄
- 使用者能收到完成回覆

---

## 目前阻塞點

真正要做上線版 LINE 整合時，需要：

1. LINE Official Account
2. Channel access token
3. Channel secret
4. 可對外的 webhook URL

---

## 建議實作順序

1. 先做 webhook endpoint 與 signature 驗證
2. 再做最小 session state
3. 再做 booking create flow
4. 最後補 reply message 與 CRM 標記
