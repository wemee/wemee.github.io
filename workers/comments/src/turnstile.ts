// Cloudflare Turnstile 驗證

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

/**
 * 向 Turnstile 驗證前端傳來的 token。
 * 若未設定 secret,回傳 false(fail-closed,寧可擋掉也不放行)。
 */
export async function verifyTurnstile(
  secret: string | undefined,
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  if (!secret || !token) return false;

  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (remoteIp) form.append('remoteip', remoteIp);

  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body: form });
    const data = (await res.json()) as SiteVerifyResponse;
    return data.success === true;
  } catch {
    return false;
  }
}
