// 留言系統前端設定。這兩個值都是「公開」資訊,可以安全寫進前端原始碼。
//   - API_BASE:Cloudflare Worker 的網址
//   - TURNSTILE_SITE_KEY:Turnstile 的 site key(公開金鑰,不是 secret)
//
export const COMMENTS_CONFIG = {
  API_BASE: 'https://wemee-comments.wemee7012.workers.dev',
  // Turnstile widget「wemee」(網域 wemee.github.io + localhost,Managed 模式)
  TURNSTILE_SITE_KEY: '0x4AAAAAADYkVtWIJoT_VAGJ',
} as const;
