# PulseFit AI / AI_GYM_updated

健身房 AI 預約機器人 MVP / demo 版。

## 目前完成內容

- 品牌化首頁與正式 UI
- 方案展示區
- 聊天入口 demo
- FAQ 問答互動區
- Booking Lookup（手機 + Email）
- 體驗課預約 / 名單收集表單
- 最小可用後端 API
- SQLite 資料層
- `/chat` 真 AI + fallback 結構
- API-ready 結構（demo / HTTP API 可切換）
- 可本機執行、可 build、可部署

## 前端啟動

```bash
npm run dev
```

## 後端啟動

```bash
npm run dev:server
```

## 一次啟動前後端

```bash
npm run dev:stack
```

## API smoke test

```bash
npm run smoke:api
```

預設 API 位址：
- `http://127.0.0.1:8787`

SQLite 檔案位置：
- `server/data/pulsefit.db`

## HTTP API 模式

建立 `.env.local`：

```env
VITE_API_MODE=http
VITE_API_BASE_URL=http://127.0.0.1:8787
```

## /chat 真 AI 模式

若要讓 `/chat` 真的呼叫 AI，於執行後端前設定：

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

若沒有 key，或外部 AI 暫時失敗，會自動 fallback。

## 文件

- `docs/API_INTEGRATION.md`
- `docs/DEPLOYMENT.md`
- `docs/PROJECT_PLAN.md`
- `docs/ACCEPTANCE_CHECKLIST.md`

## 專案結構

- `src/data/content.ts`：展示內容
- `src/lib/demoApi.ts`：demo API adapter
- `src/lib/api.ts`：API mode 切換入口
- `server/index.mjs`：最小可用後端 API
- `server/db.mjs`：SQLite 資料層
- `server/ai.mjs`：真 AI / fallback 切換層
- `server/data/pulsefit.db`：SQLite 資料庫
- `scripts/dev-stack.mjs`：一鍵啟動前後端
- `scripts/smoke-api.mjs`：API smoke test
- `src/types.ts`：共用型別
