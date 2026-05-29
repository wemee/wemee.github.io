// 共用工具:雜湊、輸入清理、限制常數

export const LIMITS = {
  CONTENT_MAX: 2000,
  NICK_MAX: 50,
  LINK_MAX: 200,
  PAGE_MAX: 300,
  // 同一來源 IP 兩則留言的最小間隔(毫秒)
  RATE_WINDOW_MS: 15_000,
} as const;

/** SHA-256 後轉 hex。用於把來源 IP 加鹽雜湊,不存明碼。 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 去掉控制字元、首尾空白,並截斷長度。回傳清理後字串。 */
export function clean(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  // 移除 ASCII 控制字元,但保留換行(0x0A)與 tab(0x09)
  const stripped = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return stripped.trim().slice(0, maxLen);
}

/** 只接受 http(s) 連結,其餘一律當空字串(擋 javascript: 等)。 */
export function cleanLink(value: unknown): string {
  const raw = clean(value, LIMITS.LINK_MAX);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}
