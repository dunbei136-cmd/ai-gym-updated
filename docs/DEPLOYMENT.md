# PulseFit AI Deployment SOP

## 目前線上架構

這個專案目前不是只有純前端靜態站，實際上分成兩條：

### 1. 前台展示站
- Platform: Vercel
- Public URL: <https://ai-gym-updated.vercel.app>
- 用途：品牌頁、FAQ、聊天入口 demo、booking lookup、admin/CRM demo UI

### 2. 後端 / LINE webhook / chat API
- Platform: Railway
- Service: `pulsefit-backend-production`
- Live API Base URL: <https://pulsefit-backend-production.up.railway.app>
- LINE Webhook URL: <https://pulsefit-backend-production.up.railway.app/integrations/line/webhook>
- 用途：`/chat`、`/bookings`、`/auth`、LINE webhook、SQLite backend

---

## GitHub Source of Truth

目前 Railway backend 已改為從 GitHub repo 拉 code。

- GitHub repo: <https://github.com/dunbei136-cmd/ai-gym-updated>
- Branch: `main`
- Root Directory: **留空**

### 重要
不要把 Railway 的 Root Directory 設成 `ai-gym-updated`。

原因：
這個 GitHub repo 本身就是 `ai-gym-updated` 專案根目錄，裡面已經直接有：

- `package.json`
- `server/`
- `src/`
- `docs/`

如果 Root Directory 還填 `ai-gym-updated`，Railway 會去找不存在的子資料夾，導致抓錯位置或部署失敗。

---

## Railway 目前正確設定

在 Railway 的 `pulsefit-backend-production` service：

- Source Repo: `dunbei136-cmd/ai-gym-updated`
- Branch: `main`
- Root Directory: **空白**

若重新接 repo，請確認這三項。

---

## 標準部署流程（Backend）

### A. 本地完成修改後
先在本機驗證：

```bash
npm run build
npm run smoke:api
```

如果有本地 server：

```bash
npm run dev:server
```

---

### B. 提交程式碼
在本機 commit 變更。

範例：

```bash
git status
git add .
git commit -m "Describe the change"
```

---

### C. Push 到 GitHub
這個 repo 目前是獨立 GitHub repo，直接 push 到 `main`。

```bash
git push origin main
```

如果本機不是獨立 repo，而是 workspace 子資料夾，需要注意不要把整個 workspace 一起推上去。

之前的安全做法是只推 `ai-gym-updated` 子專案到獨立 GitHub repo。

---

### D. Railway Deploy
1. 打開 Railway 專案
2. 進入 `pulsefit-backend-production`
3. 到 `Deployments`
4. 按 **Deploy Latest / Redeploy**

如果 Railway 已正確接 GitHub，有時也會自動觸發部署；但最穩定的流程仍是手動確認 deploy 成功。

---

## 標準驗證流程（Deploy 後）

### 1. 先驗 `/health`

```bash
GET https://pulsefit-backend-production.up.railway.app/health
```

確認：
- service 正常
- DB 正常
- LINE config 仍在
- `metrics` 有回來（可用來看 chat / validation / LINE webhook 近期狀態）

---

### 2. 驗 `/chat`

至少測這幾句：

- `你好`
- `你在幹嘛`
- `價格怎麼算`
- `我要預約`
- `我要查詢`

### 期望結果
- `你好`：自然 greeting，不是固定 booking CTA
- `你在幹嘛`：small talk 型回覆，不鬼打牆
- `價格怎麼算`：價格 / 方案導向回覆
- `我要預約`：進預約導流
- `我要查詢`：導向 booking lookup

---

### 3. 再驗 LINE
進 LINE 官方帳號實測：

- `你好`
- `你在幹嘛`
- `價格怎麼算`
- `我要預約`
- `我要查詢`

如果 Railway `/chat` 正常但 LINE 異常，再往下查：
- webhook URL 是否正確
- LINE webhook request 是否有進 Railway
- 是否有 LINE 端延遲 / 重送

---

## 這次實際踩到的坑

### 問題 1：Railway 沒接 GitHub repo
症狀：
- Redeploy 看起來成功
- 但 live API 完全沒變

原因：
- Railway 當時沒有 repo source
- redeploy 只是把舊 build 再跑一次

修法：
- 接上 GitHub repo
- 設定 branch `main`
- Root Directory 留空

---

### 問題 2：repo 雖存在，但本地沒有 remote 可反推
症狀：
- 本地 `git remote -v` 沒有指向 GitHub
- Railway 也看不到 repo

修法：
- 建立獨立 GitHub repo
- 把 `ai-gym-updated` 專案內容 push 上去

---

### 問題 3：聊天邏輯修了，但測到的是 LINE live bot 舊版
症狀：
- 本地修正後，LINE 上還是舊回覆

原因：
- 測的是 Railway live backend
- 不是本地 dev server

修法：
- 直接測 live `/chat`
- 確認 Railway 是否真的跑新版本

---

## 建議的 Deploy Checklist

每次 deploy 前後都照這張表走：

### Deploy 前
- [ ] `npm run build` 通過
- [ ] `npm run smoke:api` 通過
- [ ] 變更已 commit
- [ ] 變更已 push 到 GitHub `main`

### Deploy 中
- [ ] Railway source repo 正確
- [ ] Railway branch = `main`
- [ ] Railway root directory 為空
- [ ] Railway deployment 成功

### Deploy 後
- [ ] `/health` 正常
- [ ] `/chat` greeting 正常
- [ ] `/chat` small talk 正常
- [ ] `/chat` pricing 正常
- [ ] LINE 實測正常

---

## 建議的 Smoke Commands

### 本地 build

```bash
npm run build
```

### 本地 API smoke

```bash
npm run smoke:api
```

### 線上 chat smoke（概念）

```bash
POST /chat
{ "message": "你好" }
```

---

## 簡短結論

目前正確的上線路徑是：

> GitHub repo (`dunbei136-cmd/ai-gym-updated`) → Railway (`pulsefit-backend-production`) → LINE webhook / live chat API

前台展示站仍可獨立走：

> Vercel (`ai-gym-updated.vercel.app`)

以後如果發生「本地改了但 LINE 沒變」，先不要猜，直接先查這三件事：

1. GitHub 有沒有最新 commit
2. Railway 是否真的 deploy 到最新 source
3. live `/chat` 回覆有沒有變
