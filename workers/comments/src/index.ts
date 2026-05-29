import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { LIMITS, sha256Hex, clean, cleanLink } from './util';
import { verifyTurnstile } from './turnstile';

interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  ADMIN_TOKEN?: string;
  TURNSTILE_SECRET?: string;
}

// 對外回傳的留言形狀(不含 ip_hash 等私密欄位)
interface PublicComment {
  id: number;
  parentId: number | null;
  nick: string;
  link: string | null;
  content: string;
  createdAt: number;
}

const app = new Hono<{ Bindings: Env }>();

// ---- CORS:只放行設定檔列出的來源 ----
app.use('/api/*', async (c, next) => {
  const allowed = c.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  const handler = cors({
    origin: (origin) => (allowed.includes(origin) ? origin : ''),
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });
  return handler(c, next);
});

app.get('/api/health', (c) => c.json({ ok: true }));

// ---- 取得某頁留言(只回 visible,舊到新) ----
app.get('/api/comments', async (c) => {
  const page = clean(c.req.query('page'), LIMITS.PAGE_MAX);
  if (!page) return c.json({ error: 'missing page' }, 400);

  const { results } = await c.env.DB.prepare(
    `SELECT id, parent_id, nick, link, content, created_at
     FROM comments
     WHERE page = ? AND status = 'visible'
     ORDER BY created_at ASC
     LIMIT 500`,
  )
    .bind(page)
    .all<Record<string, unknown>>();

  const comments: PublicComment[] = (results ?? []).map((r) => ({
    id: r.id as number,
    parentId: (r.parent_id as number | null) ?? null,
    nick: r.nick as string,
    link: (r.link as string | null) || null,
    content: r.content as string,
    createdAt: r.created_at as number,
  }));

  return c.json({ comments });
});

// ---- 新增留言 ----
app.post('/api/comments', async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }

  const page = clean(body.page, LIMITS.PAGE_MAX);
  const nick = clean(body.nick, LIMITS.NICK_MAX);
  const content = clean(body.content, LIMITS.CONTENT_MAX);
  const link = cleanLink(body.link);
  const parentId =
    typeof body.parentId === 'number' && Number.isInteger(body.parentId)
      ? body.parentId
      : null;
  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';

  if (!page || !nick || !content) {
    return c.json({ error: '暱稱與留言內容不可空白' }, 400);
  }

  const ip = c.req.header('CF-Connecting-IP') ?? '';

  // Turnstile 驗證(fail-closed)
  const passed = await verifyTurnstile(c.env.TURNSTILE_SECRET, token, ip);
  if (!passed) {
    return c.json({ error: '人機驗證未通過,請重試' }, 403);
  }

  // 來源 IP 加鹽雜湊(用 ADMIN_TOKEN 當鹽;沒設就退而求其次)
  const salt = c.env.ADMIN_TOKEN ?? 'wemee-salt';
  const ipHash = ip ? await sha256Hex(ip + salt) : null;

  // 簡單速率限制:同一 IP 在時間窗內已留過就擋
  if (ipHash) {
    const since = Date.now() - LIMITS.RATE_WINDOW_MS;
    const recent = await c.env.DB.prepare(
      `SELECT id FROM comments WHERE ip_hash = ? AND created_at > ? LIMIT 1`,
    )
      .bind(ipHash, since)
      .first();
    if (recent) {
      return c.json({ error: '留言太頻繁,請稍候再試' }, 429);
    }
  }

  const createdAt = Date.now();
  const result = await c.env.DB.prepare(
    `INSERT INTO comments (page, parent_id, nick, link, content, created_at, ip_hash, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'visible')`,
  )
    .bind(page, parentId, nick, link || null, content, createdAt, ipHash)
    .run();

  const comment: PublicComment = {
    id: result.meta.last_row_id as number,
    parentId,
    nick,
    link: link || null,
    content,
    createdAt,
  };

  return c.json({ comment }, 201);
});

// ---- 管理:驗證 bearer token ----
function requireAdmin(c: { req: { header: (k: string) => string | undefined }; env: Env }): boolean {
  const token = c.env.ADMIN_TOKEN;
  if (!token) return false;
  const auth = c.req.header('Authorization') ?? '';
  return auth === `Bearer ${token}`;
}

// ---- 管理:列出最近留言(含已刪除)供審核 ----
app.get('/api/admin/comments', async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'unauthorized' }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT id, page, parent_id, nick, link, content, created_at, status
     FROM comments
     ORDER BY created_at DESC
     LIMIT 200`,
  ).all();

  return c.json({ comments: results ?? [] });
});

// ---- 管理:軟刪除一則留言 ----
app.delete('/api/admin/comments/:id', async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'unauthorized' }, 401);

  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'invalid id' }, 400);

  await c.env.DB.prepare(`UPDATE comments SET status = 'deleted' WHERE id = ?`)
    .bind(id)
    .run();

  return c.json({ ok: true });
});

export default app;
