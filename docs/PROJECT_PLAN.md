# AI_GYM_updated 專案整理

## 專案定位

做出一個 **可跑、可 demo、可對外展示** 的健身房 AI 預約 / CRM MVP。

這版仍然不是 production，但目前已經完成：

- 可本機穩定運行
- 可 build / 可部署
- 可展示前台導流 + 後台 CRM 跟進流程
- 可用本地 QA 腳本驗證主要操作

## 目前已完成範圍

### 前台使用者流程

1. **網站聊天入口**
   - 回答基本 FAQ
   - 推薦課程或方案
   - 引導使用者進到預約或查詢

2. **FAQ 問答區**
   - 提供常見問題展示
   - 適合現場 demo 與銷售介紹

3. **Booking Lookup**
   - 使用手機號碼 + Email 查詢
   - 可顯示 demo 預約資料與新建立資料

4. **Lead / booking 建立**
   - 可從前台表單建立名單
   - 可從 admin 端快速建立 booking

### 後台 / CRM 流程

1. **Admin booking 清單**
   - 搜尋、篩選、排序、分頁
   - 狀態總覽與 CRM 統計

2. **Batch 操作**
   - 批次改狀態
   - 批次改 CRM 欄位
   - 匯出已勾選 / 匯出 CSV
   - 批次刪除

3. **Booking detail panel**
   - 編輯課程、教練、預約時間、備註、來源、負責人、follow-up
   - dirty-check 與快捷鍵儲存

4. **Activity log / pipeline**
   - 手動新增聯絡紀錄
   - 狀態與 detail 變更自動留痕
   - pipeline board 與 stage 更新

## 目前技術選型

- **Vite + React + TypeScript**
- SQLite 後端資料層
- Demo / HTTP API 可切換
- `/chat` 支援真 AI + fallback
- Playwright 本地 QA 腳本

## 已補齊的驗證

- `npm run build`
- `npm run smoke:api`
- `npm run qa:workflow-local`
- `npm run qa:edge-local`
- `npm run qa:all-local`

## 下一階段建議

### Phase 2
- 串接真實 AI API / 真實 CRM
- 建立正式身分驗證與權限控管
- 補正式後端驗證 / audit trail / API 安全性
- 補更完整的部署與監控流程

### Phase 3
- LINE / Web chat / CRM 整合
- 正式會員資料管理
- 客服接手流程
- Production-ready 權限、稽核、營運面板
