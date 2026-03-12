# 部署建議

這個版本是純前端靜態站，適合部署到：

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages（也可，但流程稍麻煩）

## 已補上的部署檔

- `vercel.json`
- `netlify.toml`

## 最簡單做法

1. 把 `ai-gym-updated` 推到 GitHub
2. 在 Vercel 或 Netlify 匯入 repo
3. Build command 設為：
   - `npm run build`
4. Output directory 設為：
   - `dist`

## 目前這版部署後能做什麼

- 展示 FAQ / 方案 / 聊天入口
- 用表單建立 demo 預約
- 用手機 + Email 查詢剛建立的預約
- 透過瀏覽器 localStorage 保留 demo 資料

## 正式版前你可能會再補的東西

- 自訂網域
- 真實 API endpoint
- 環境變數
- 後端服務
- CRM / LINE / Google Sheet 串接
- 正式會員與預約資料庫
