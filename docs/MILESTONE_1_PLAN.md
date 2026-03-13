# Milestone 1 Plan — Admin Boundary Foundation

## 目標

把目前的 demo MVP，往「有後台邊界的內部工具」推進。

完成後應該具備：

- 有 admin login
- 後台與 API 不再完全裸奔
- API 請求有基本驗證
- 錯誤格式統一
- 重要變更可留下基本 audit log

---

## 任務拆解

### Task 1 — Auth 基礎

#### 目標
建立最小可用的 admin login 機制。

#### 內容
- login form
- 後端 login endpoint
- session / token 儲存策略
- logout 流程
- 前端登入狀態檢查

#### 驗收
- 未登入不可進後台
- 登入成功可進後台
- 登出後無法再打 protected API

---

### Task 2 — Protect Admin Routes / APIs

#### 目標
讓後台畫面與寫入 API 需要登入。

#### 內容
- 保護 admin UI
- 保護 create / update / delete / batch API
- 保護 CRM 寫入操作
- 保留必要 public endpoints（若需要）

#### 驗收
- 未授權請求回 401 / 403
- 已授權請求可正常操作

---

### Task 3 — Request Validation

#### 目標
替主要 API 加上 schema validation。

#### 優先路由
- `POST /bookings`
- `POST /bookings/status`
- `POST /bookings/details`
- `DELETE /bookings`
- `POST /chat`

#### 驗收
- 缺欄位時回明確錯誤
- 非法 enum / 格式錯誤時可擋下
- 錯誤 response 統一

---

### Task 4 — Error Contract

#### 目標
統一 API success / error 格式。

#### 建議格式
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "..."
  }
}
```

#### 驗收
- API 錯誤格式一致
- 前端可依 code / message 顯示錯誤

---

### Task 5 — Basic Audit Log

#### 目標
把重要 admin 操作寫成正式 audit 記錄。

#### 先做的事件
- login / logout
- create booking
- update status
- update details
- delete booking
- batch actions

#### 驗收
- 可記錄誰、何時、做了什麼
- 至少可查最近操作

---

## 建議實作順序

1. Auth 基礎
2. Protect Admin Routes / APIs
3. Request Validation
4. Error Contract
5. Basic Audit Log

---

## 建議的第一個 coding slice

如果要從最小的一刀開始，我建議先做：

### Slice A
- admin login form
- login endpoint
- 前端登入狀態 guard

這一刀做完，就能正式開始把後台從 demo 狀態切出來。
