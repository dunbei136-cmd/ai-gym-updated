# PulseFit AI Next Steps

這份文件是把目前 `ai-gym-updated` 收斂成：

- 已完成什麼
- 還缺什麼
- 下一步最值得做什麼
- 建議的優先順序

避免後續只靠聊天紀錄回憶。

---

## 一句話狀態

目前 `ai-gym-updated` 已經是：

> 可展示、可操作、可部署、可驗證的 gym booking / CRM demo MVP

但還不是 production 系統。

---

## 已完成（Done）

### 1. 前台體驗
- 品牌化 landing page
- FAQ 問答區
- 聊天入口 demo
- booking lookup
- lead / booking 建立流程

### 2. 後台 / CRM
- admin booking 清單
- 搜尋 / 篩選 / 排序 / 分頁
- CSV 匯出
- 批次狀態更新
- 批次 CRM 欄位更新
- 批次刪除
- booking detail panel
- follow-up 設定
- activity log 手動新增
- activity log 自動留痕
- pipeline board
- stage 更新 / pipeline 拖拉
- dirty-check / busy-state / interaction lock

### 3. 技術與資料層
- Vite + React + TypeScript
- demo / HTTP API mode 切換
- SQLite backend
- `/chat` AI + fallback 架構
- LINE webhook backend 路徑
- Railway backend 已接 GitHub source
- live deploy 路徑已打通

### 4. 聊天 / LINE 修復
- 修掉 greeting / small talk 落入固定 booking CTA 的問題
- 補了 softer fallback
- 補了 anti-repeat 保護
- live Railway backend 已完成修復部署

### 5. 文檔與驗證
- `docs/CURRENT_STATUS.md`
- `docs/DEPLOYMENT.md`
- `docs/DELIVERY_HANDOFF.md`
- `docs/REGRESSION_CHECKLIST.md`
- 驗證指令：
  - `npm run build`
  - `npm run smoke:api`
  - `npm run qa:workflow-local`
  - `npm run qa:edge-local`
  - `npm run qa:all-local`

---

## 尚未完成（Not Done Yet）

### 1. Production 級登入與權限
- admin auth 現在是 demo / foundation
- 還缺正式權限模型
- 還缺更完整的 route protection

### 2. 後端驗證 / 安全性
- request schema validation 還不完整
- error contract 還能再統一
- audit / permission / security hardening 還不夠 production-ready

### 3. 真實外部整合
- 真實 CRM integration
- 更完整的 LINE / messaging integration
- 真實會員 / 課程 / 預約資料來源
- 人工客服接手流程

### 4. 監控與治理
- deploy / backup / monitoring 還不完整
- 缺少 production 級 alert / observability
- 缺少 repeated reply / fallback metrics 儀表板

### 5. 更進一步的聊天品質
- pricing / course recommendation 可再更自然
- 新手 / 老手分流可再更穩
- 轉人工 / 客服 handoff 還沒完整落地

---

## 建議優先順序（Priority Order）

## P0 — 已經完成但要持續維持
這些不是新開發，而是每次改動都要守住：
- deploy SOP 正常
- regression checklist 有照跑
- Railway source / branch / root directory 不再設錯
- live `/chat` 與 LINE 不再回到舊 fallback 鬼打牆

---

## P1 — 最值得先做

### 1. 統一聊天文案與 routing 品質
目標：
- web chat / demoApi / live backend / LINE 回話風格不要再分裂
- greeting / pricing / booking / lookup 的 routing 更穩

為什麼先做：
因為這是最直接會被使用者看到的體感，也是剛修好的區塊。

### 2. 補更完整的 request validation / error contract
目前狀態：
- 基礎 schema 與一致的 `VALIDATION_ERROR + details` 已補上

剩餘目標：
- 擴大到更多 edge case
- 補更完整的 request/response 文件
- 讓前端更好吃這份 error contract

### 3. 補 monitoring / admin debug 訊號
目標：
- 看得到 fallback rate
- 看得到 repeated reply rate
- 看得到 live webhook 最近事件

---

## P2 — 下一階段系統化

### 1. 正式 admin auth / permission model
- 使用者 / admin 權限分層
- route / mutation 真正保護起來

### 2. CRM / messaging / handoff 整合
- 更完整 CRM 寫入
- LINE / Web 對話與 CRM state 一致
- 能標記需要人工接手的 lead

### 3. Production deploy / backup / rollback 策略
- 明確的 rollback 方式
- deploy 後 smoke 自動化
- 關鍵環境變數管理

---

## P3 — Demo polish / presentation value

### 1. 視覺與文案 polish
- loading / notice / error 體感統一
- 空狀態與提示文案更順
- seed data 更像真實情境

### 2. KPI / dashboard 展示
- 更多 funnel / conversion 指標
- admin 端更完整的 summary blocks

---

## 建議的下個執行批次

如果現在要再往前推一個 batch，我建議直接做這包：

### Batch A
- 統一 chat / LINE / fallback 話術
- 補 request validation
- 補 error contract
- 補 live debug / metrics 基礎欄位

這會比單純再改 UI 更有價值，因為：
- 直接改善穩定性
- 直接改善 demo 體感
- 直接降低下次 deploy 出事時的排查成本

---

## 最短結論

### 已完成
- demo MVP 本身已經夠完整
- live deploy 鏈路已經打通
- LINE / Railway / GitHub 這條真實上線路徑已驗證

### 還沒完成
- production 級安全性、權限、治理、監控
- 更完整 CRM / messaging integration

### 下一步最合理
> 先補穩定性與後端邊界，再做 production 化，而不是只繼續堆 UI。
