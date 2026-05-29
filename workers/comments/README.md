# wemee 留言系統(Cloudflare Worker + D1)

全站留言 API,自建後端,純靜態前端透過 fetch 呼叫。資料存在 Cloudflare D1。

- **Worker 網址**:https://wemee-comments.wemee7012.workers.dev
- **D1 資料庫**:`wemee-comments`
- **前端設定**:`src/config/comments.ts`(API 網址 + Turnstile site key)
- **前端元件**:`src/components/comments/`,掛在 `BaseLayout.astro`,預設全站開啟
  - 個別頁面關閉:`<BaseLayout comments={false} …>`

## API

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/comments?page=<path>` | 取某頁可見留言 |
| POST | `/api/comments` | 新增留言(需 Turnstile token) |
| GET | `/api/admin/comments` | 列出最近 200 則(含已刪)— 需 bearer |
| DELETE | `/api/admin/comments/:id` | 軟刪除一則 — 需 bearer |

## Secrets(用 `wrangler secret put` 設定,不進版控)

- `ADMIN_TOKEN` — 管理 bearer token(刪留言用)
- `TURNSTILE_SECRET` — Cloudflare Turnstile secret key

## 防護

- **Turnstile** 人機驗證(fail-closed:沒驗證過一律擋)
- **速率限制**:同一來源 IP 15 秒內只能留一則(IP 經加鹽 SHA-256,不存明碼)
- **審核**:先顯示後刪除(post-moderation)

## 常用指令

```bash
cd workers/comments
npm install
npm run deploy          # 部署 Worker
npm run schema          # 套用 schema 到遠端 D1

# 刪除一則留言
curl -X DELETE https://wemee-comments.wemee7012.workers.dev/api/admin/comments/<id> \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# 看最近留言(審核)
curl https://wemee-comments.wemee7012.workers.dev/api/admin/comments \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
