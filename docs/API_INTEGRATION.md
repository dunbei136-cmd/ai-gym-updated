# API Integration Notes

目前前端已抽出 API layer，且專案內已附最小可用後端 API。

## 可切換模式

### 1. Demo mode
使用 localStorage 當資料來源，適合 demo / 提案 / 純靜態部署。

```env
VITE_API_MODE=demo
```

### 2. HTTP API mode
切到本專案附帶的後端 API，或未來自己的遠端服務。

```env
VITE_API_MODE=http
VITE_API_BASE_URL=http://127.0.0.1:8787
```

## 本專案內建 API server

啟動方式：

```bash
npm run dev:server
```

或直接：

```bash
npm run dev:stack
```

預設 port：`8787`

## 資料層

目前後端使用 **SQLite**。

資料庫檔案：
- `server/data/pulsefit.db`

資料表：
- `bookings`

## /chat 雙 provider + fallback

`/chat` 現在支援：
- OpenAI
- Gemini
- fallback 規則回覆

推薦設定：

```env
AI_PROVIDER=auto
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
```

### provider 策略
- `AI_PROVIDER=auto`：先試 OpenAI，再試 Gemini，最後 fallback
- `AI_PROVIDER=openai`：先試 OpenAI，再試 Gemini，最後 fallback
- `AI_PROVIDER=gemini`：先試 Gemini，再試 OpenAI，最後 fallback

若某個 provider rate limit、沒 key、或暫時失敗，系統會自動嘗試下一個 provider，不會直接中斷。

## 預期 API 端點

### GET /health
健康檢查，回傳 service、SQLite metadata、AI strategy metadata

### GET /bookings
回傳 booking 清單

### POST /bookings
建立或更新 booking

Request body:
```json
{
  "name": "王小明",
  "phone": "0912345678",
  "email": "ming@example.com",
  "goal": "減脂 / 新手入門",
  "preferredSlot": "平日晚上"
}
```

### GET /bookings/lookup?phone=...&email=...
查詢單筆 booking

### POST /bookings/status
更新 booking 狀態

Request body:
```json
{
  "phone": "0912345678",
  "email": "ming@example.com",
  "status": "已確認"
}
```

### POST /chat
Request body:
```json
{
  "message": "我想了解會員方案"
}
```

Response body:
```json
{
  "mode": "openai | gemini | fallback",
  "reply": "..."
}
```

## 目前前端已準備好

- `src/lib/api.ts`：API 切換入口
- `src/lib/demoApi.ts`：demo adapter
- `server/index.mjs`：最小可用 HTTP API
- `server/db.mjs`：SQLite 資料層
- `server/ai.mjs`：OpenAI / Gemini / fallback 切換層
- `src/types.ts`：共用型別
- `src/data/content.ts`：內容資料
