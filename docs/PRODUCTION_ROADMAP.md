# PulseFit AI / Production Roadmap

## 目標

把目前的 booking / CRM demo MVP，往可正式營運的系統推進。

這不代表立刻全部上線，而是把工作拆成可執行的階段。

---

## Phase P1 — 安全與邊界先補齊

### 1. 身分驗證 / 權限控管
- admin login
- session / token 管理
- role-based access（例如 admin / staff）
- 保護後台頁面與 API

### 2. API 輸入驗證
- 對 `/bookings`、`/bookings/details`、`/bookings/status` 等路由做 schema validation
- 防止空值、格式錯誤、非法 stage / status
- 統一 error response 格式

### 3. 基本安全 hardening
- rate limiting
- CORS / origin policy 收斂
- 更安全的錯誤輸出
- 環境變數管理

---

## Phase P2 — 正式資料流

### 4. 正式資料模型整理
- booking / lead / activity / user schema 梳理
- migration 策略
- 欄位命名與 enum 收斂

### 5. 稽核與歷程
- activity log 改成更正式的 audit trail
- 記錄誰在何時改了什麼
- 留存 status / assignee / stage 變更紀錄

### 6. 更完整的後端錯誤處理
- domain-level errors
- retryable / non-retryable 區分
- API status code 整理

---

## Phase P3 — 外部整合

### 7. 真 AI 流程
- 更明確的 provider strategy
- prompt / guardrail / fallback 整理
- AI 與 booking / CRM 流程串接

### 8. CRM / Messaging 整合
- LINE / Web chat / 其他通路
- 真實 lead 來源接入
- 客服接手流程

### 9. 權限與操作紀錄
- staff account 管理
- 重要操作稽核
- 敏感欄位保護

---

## Phase P4 — 部署與營運

### 10. 正式部署流程
- staging / production 區分
- deploy checklist
- rollback 策略

### 11. 監控與維運
- health checks
- logging
- error reporting
- backup / restore

### 12. Production QA
- e2e 測試擴充
- 權限測試
- API contract 測試
- deploy 後 smoke checks

---

## 建議優先順序

如果只先做最有價值的一批，建議順序是：

1. auth / role-based access
2. API schema validation
3. audit trail
4. deployment / env / monitoring 基礎
5. 真 AI + messaging / CRM integration

---

## 建議的第一個實作 milestone

### Milestone 1
先把系統從 demo 拉到「有後台邊界」：

- admin login
- protected API
- request validation
- 統一錯誤格式
- 最基本 audit log

完成這一批後，系統就會從「可展示 demo」跨到「有營運骨架的內部工具」。
