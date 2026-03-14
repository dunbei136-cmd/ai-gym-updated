# PulseFit AI Regression Checklist

這份清單是給 deploy 後、demo 前、或功能改動後做快速回歸驗證用的。

---

## 0. Deploy / Environment Sanity Check

### GitHub / Railway Source
- [ ] GitHub repo 為 `dunbei136-cmd/ai-gym-updated`
- [ ] Railway service 為 `pulsefit-backend-production`
- [ ] Railway source branch 為 `main`
- [ ] Railway root directory 為空
- [ ] 最新 deploy 狀態為 success

### Live Endpoints
- [ ] Vercel 前台可開啟：<https://ai-gym-updated.vercel.app>
- [ ] Railway health 可開啟：<https://pulsefit-backend-production.up.railway.app/health>
- [ ] LINE webhook URL 為：<https://pulsefit-backend-production.up.railway.app/integrations/line/webhook>

---

## 1. Web Chat 回歸

### Greeting / Small Talk
- [ ] `你好` 會得到自然 greeting，不是固定 booking CTA
- [ ] `你在幹嘛` 會得到 small talk 回覆，不鬼打牆
- [ ] 連續發兩句短訊息時，不會重複一模一樣的 assistant 回覆

### FAQ / Routing
- [ ] `價格怎麼算` 會得到價格 / 方案導向回覆
- [ ] `我是新手，推薦什麼課` 會得到新手課程建議
- [ ] `我要預約` 會導向預約流程
- [ ] `我要查詢` 會導向 lookup / phone + email 流程

### 體感
- [ ] 回覆沒有明顯機器式重播
- [ ] 沒有所有句子都導回「我要預約」
- [ ] greeting / pricing / booking 至少能分流

---

## 2. LINE 回歸

### 基本對話
- [ ] `你好` 正常
- [ ] `你在幹嘛` 正常
- [ ] `價格怎麼算` 正常
- [ ] `我要預約` 會開始蒐集資料
- [ ] `我要查詢` 會開始查詢流程

### 預約蒐集流程
- [ ] 姓名可成功記錄
- [ ] 手機格式錯誤時會提醒重填
- [ ] Email 格式錯誤時會提醒重填
- [ ] 目標可成功記錄
- [ ] 偏好時段可成功記錄
- [ ] 完成後會建立 booking 並回覆成功訊息

### 查詢流程
- [ ] 查詢時會先要手機
- [ ] 再要 Email
- [ ] 找到資料時可回覆 booking 狀態
- [ ] 找不到資料時會提示確認手機 / Email

### 取消 / 重來
- [ ] `取消` 可清掉 session
- [ ] `重來` 可重新開始流程

---

## 3. Booking / Lookup 回歸

### 前台建立 booking
- [ ] 可從 lead form 建立一筆 booking
- [ ] 建立後可看到成功提示
- [ ] 新 booking 會進 admin / CRM 清單

### Booking Lookup
- [ ] 用手機 + Email 可查到剛建立的 booking
- [ ] 查到時顯示正確狀態 / 教練 / 時間
- [ ] 查不到時顯示空狀態，不會 crash

---

## 4. Admin / CRM 回歸

### 讀取與登入
- [ ] admin 頁可正常載入
- [ ] demo admin 帳密可登入
- [ ] 未登入時寫入操作會被擋住

### 清單功能
- [ ] 搜尋正常
- [ ] 篩選正常
- [ ] 排序正常
- [ ] 分頁正常
- [ ] CSV 匯出正常

### 單筆編輯
- [ ] detail panel 可打開
- [ ] 可編輯姓名 / 課程 / 教練 / 時間
- [ ] 可改 stage / source / assignee
- [ ] 可設 next follow-up
- [ ] 可存 notes
- [ ] 可新增 activity log
- [ ] 儲存後資料有更新

### 批次操作
- [ ] 批次選取正常
- [ ] 批次改 status 正常
- [ ] 批次改 CRM 欄位正常
- [ ] 批次匯出正常
- [ ] 批次刪除正常

### Pipeline
- [ ] pipeline board 顯示正常
- [ ] stage 拖拉正常
- [ ] 拖拉後 detail / table / stats 會同步更新

---

## 5. API / Server 回歸

### Local Commands
- [ ] `npm run build`
- [ ] `npm run smoke:api`
- [ ] `npm run smoke:auth`
- [ ] `npm run qa:workflow-local`
- [ ] `npm run qa:edge-local`
- [ ] `npm run qa:all-local`

### Live API Smoke
- [ ] `GET /health` 成功
- [ ] `POST /chat` greeting 成功
- [ ] `POST /chat` pricing 成功
- [ ] `POST /chat` booking intent 成功

---

## 6. 這次特別要避免的 Regression

- [ ] Railway redeploy 的其實是舊 source
- [ ] Railway source repo 設錯
- [ ] Railway root directory 設錯
- [ ] GitHub push 有成功但 Railway 沒吃到最新 deploy
- [ ] web chat 正常但 LINE 還在跑舊回覆
- [ ] greeting / small talk 又掉回重複 booking CTA

---

## 7. 建議執行順序（最省時間）

### 每次 deploy 後
1. [ ] 看 Railway deploy success
2. [ ] 打 `/health`
3. [ ] 打 live `/chat` 測 `你好`
4. [ ] 打 live `/chat` 測 `價格怎麼算`
5. [ ] 去 LINE 測 `你好`
6. [ ] 去 LINE 測 `我要預約`
7. [ ] 前台建一筆 booking
8. [ ] admin 確認資料進來

---

## 簡短結論

如果只想用最少時間確認這次沒炸，最小 smoke 是：

- [ ] Railway deploy success
- [ ] `/health` OK
- [ ] `/chat` greeting OK
- [ ] `/chat` pricing OK
- [ ] LINE `你好` OK
- [ ] LINE `我要預約` OK
- [ ] 前台 booking 建立 OK
- [ ] admin 可看到該 booking
