# PulseFit AI / AI_GYM_updated 現況總結

## 目前版本定位

這個版本已經不是只有前台展示頁，而是：

- 可展示前台導流
- 可展示 booking lookup
- 可展示 admin / CRM 後台流程
- 可展示 activity log / pipeline / batch 操作
- 可用本地 QA 腳本驗證主要流程

目前適合：

- 對客 demo
- 內部展示
- 當作下一階段 production 化的基底

目前不建議直接視為 production 系統，因為還缺：

- 正式登入 / 權限控管
- 更完整的後端驗證與安全性
- 真實 CRM / 第三方系統整合
- production 級監控與部署治理

## 已完成

### 前台

- 品牌化 landing page
- FAQ 問答區
- 聊天入口 demo
- booking lookup
- lead / booking 建立流程

### 後台 / CRM

- booking 清單
- 搜尋、篩選、排序、分頁
- 狀態總覽與 CRM 統計
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
- dirty-check 與操作鎖定

### 技術 / 資料層

- Vite + React + TypeScript
- demo / HTTP API mode 切換
- SQLite 後端
- `/chat` 真 AI + fallback 結構
- Railway backend 已接 GitHub source（`dunbei136-cmd/ai-gym-updated`）
- LINE webhook live 路徑已確認並完成一次實際修復部署
- backend request validation schema 已建立（含 chat / booking / auth / lookup / admin mutation）
- API validation error contract 已統一為 `VALIDATION_ERROR + details`
- client HTTP adapter 已能格式化並顯示 validation details，而不只是一句模糊錯誤
- live Railway API 已驗到新的 validation contract 生效

### QA

- `npm run build`
- `npm run smoke:api`
- `npm run qa:workflow-local`
- `npm run qa:edge-local`
- `npm run qa:all-local`

## 尚未完成 / 後續建議

### 若要進 production

1. 使用者登入 / admin 權限控管
2. 後端 schema 驗證與更完整錯誤處理
3. audit / permission / security hardening
4. 真實 AI / CRM / LINE / messaging 整合
5. deployment / monitoring / backup 策略

### 若要再 polish demo

1. 統一提示文案與 loading 體感
2. 微調視覺與內容文案
3. 增加更完整 demo seed data
4. 補更多圖表或 KPI 展示

## 建議的日常驗證指令

```bash
npm run build
npm run qa:all-local
```

若要只驗 API：

```bash
npm run smoke:api
```

## 簡短結論

目前版本可視為：

> 可展示、可操作、可驗證的健身房 booking / CRM demo MVP

如果只看 demo / MVP 目標，已經接近完成。
如果要變成 production，下一步重點是安全性、權限與外部整合。

## 建議下一步

請優先看：
- `docs/DEPLOYMENT.md`
- `docs/REGRESSION_CHECKLIST.md`
- `docs/NEXT_STEPS.md`

其中：
- `DEPLOYMENT.md` 說明怎麼上線
- `REGRESSION_CHECKLIST.md` 說明上線後怎麼驗
- `NEXT_STEPS.md` 說明接下來該先做哪一批工作
