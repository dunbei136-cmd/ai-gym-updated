# Slice A Implementation Plan — Admin Login Foundation

## 目標

先把後台從完全開放，變成「需要登入才可進入」的基本型態。

這一刀不追求完整企業級 auth，而是先建立：

- admin login form
- login endpoint
- 前端登入 guard
- logout 基礎流程

---

## 預計變更檔案

### 前端

- `src/App.tsx`
  - 增加 login view / auth state
  - 後台區塊加 guard
  - logout 入口

- `src/types.ts`
  - 增加 auth response / user session 型別

- `src/lib/api.ts`
  - 增加 login / logout / session check API
  - 送 request 時帶 auth 資訊（若採 cookie/session 則確認 fetch 設定）

### 後端

- `server/index.mjs`
  - 新增 `/auth/login`
  - 新增 `/auth/logout`
  - 新增 `/auth/session`
  - 在 admin 寫入 API 前加 auth guard

- `server/`（可能新增）
  - `auth.mjs`
    - session/token 驗證
    - login 驗證邏輯
    - helper utilities

- `server/db.mjs` 或新檔
  - 若要存 session / audit，可先準備表或暫時用 memory store（依取捨）

---

## 建議策略

### 第一版 auth 方案

先做最小可用版本：

- 單一 admin 帳密（來自 env）
- 後端發 session token
- token 可先存在記憶體 store 或簡單 session 表
- 前端登入後保存在 memory / localStorage（依實作選擇）

### 為什麼先這樣做

- 快
- 風險低
- 可以先把後台邊界立起來
- 後續再升級成更正式的 auth 架構

---

## UI 流程

### 未登入
- 顯示 admin login card
- 不顯示完整後台操作區

### 已登入
- 顯示後台區塊
- 顯示目前 admin 狀態
- 顯示 logout 按鈕

### Session 失效
- 自動退回 login 狀態
- 顯示「登入已失效，請重新登入」

---

## API 草案

### `POST /auth/login`

Request:
```json
{
  "username": "admin",
  "password": "..."
}
```

Response:
```json
{
  "ok": true,
  "session": {
    "username": "admin"
  }
}
```

### `POST /auth/logout`

Response:
```json
{
  "ok": true
}
```

### `GET /auth/session`

Response:
```json
{
  "ok": true,
  "session": {
    "username": "admin"
  }
}
```

---

## 驗收條件

- 未登入時，後台主操作不可用
- 正確登入後可進後台
- 錯誤帳密會顯示明確錯誤
- logout 後無法再做 admin 寫入操作
- session 失效時能回到登入畫面

---

## 下一步建議

真正開始 coding 時，建議順序：

1. 先做後端 `/auth/*`
2. 再做前端 login card / auth state
3. 最後把 admin 區塊與寫入 API 接上 guard
