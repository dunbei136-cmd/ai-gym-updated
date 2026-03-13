# PulseFit AI — Delivery Handoff

## 專案定位

目前專案可作為：

- 可對外展示的 gym booking / CRM demo
- 可內部驗證流程的 MVP
- 往 production phase 推進的基底

## 線上網址

- Production: https://ai-gym-updated.vercel.app

## Demo / Admin 測試帳密

- Username: `admin`
- Password: `pulsefit-demo`

> 注意：公開站目前是前端 demo mode 為主，auth / data 會以前端 demo adapter / localStorage 呈現體驗。

## 目前已完成

### 前台
- Landing page
- FAQ
- Chat entry demo
- Booking lookup
- Lead / booking create flow

### 後台 / CRM
- Admin dashboard
- Search / filter / sort / pagination
- Batch actions
- Detail panel editing
- Activity log
- Pipeline stage flow
- Auth foundation UI

### 技術 / 驗證
- Build passing
- Public Vercel deployment
- Local auth smoke
- Local workflow / edge QA
- Docs / plan / acceptance / current status / roadmap / milestone docs

## 建議驗收流程

### 1. 前台
- 打開首頁
- 試 FAQ
- 試聊天
- 建立一筆預約
- 用 lookup 查詢

### 2. 後台
- 查看 admin 清單
- 用 demo admin 帳密登入
- 試狀態更新
- 試 detail 編輯
- 試 activity log
- 試 pipeline / batch actions

### 3. 邊界
- 未登入時是否擋住寫入
- 登入後是否恢復可操作
- 聊天是否仍會出現明顯 fallback 錯亂

## 本機指令

```bash
npm run dev
npm run dev:server
npm run build
npm run smoke:api
npm run smoke:auth
npm run qa:workflow-local
npm run qa:edge-local
npm run qa:all-local
```

## 已知限制

1. 公開站目前以 demo/front-end 體驗為主，不是完整 production backend 架構
2. auth foundation 已建立，但 production 級權限控管還沒完成
3. audit log 目前是基礎版，還不是正式持久化 audit system
4. request validation / error contract 剛起步，仍可再擴充
5. 外部 CRM / LINE / messaging /正式 DB 尚未完成整合

## 下一階段優先順序

1. Request validation 擴充完整
2. Error contract 與前端錯誤處理統一
3. Audit log 持久化
4. 真正保護 admin routes / APIs 的 production 化
5. Messaging / CRM integration

## 交付判斷

如果目標是：

- **可展示 / 可體驗 / 可測試的交付版 MVP** → 可以交付
- **可正式營運的 production 系統** → 還需要下一階段
