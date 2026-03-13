# LINE Webhook Skeleton

目前已建立：

- `server/integrations/line.mjs`
- `server/line-session.mjs`
- 預計串進 `/integrations/line/webhook`

## 目前目的

先把結構搭起來，等之後補：
- LINE_CHANNEL_ACCESS_TOKEN
- LINE_CHANNEL_SECRET

## 下一步

1. 在 server 增加 webhook route
2. 驗 LINE signature
3. 建最小 booking flow state machine
4. 回覆 LINE message
