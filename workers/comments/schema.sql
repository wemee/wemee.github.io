-- wemee.github.io 留言系統 D1 schema
-- 套用:npm run schema (遠端) / npm run schema:local (本機)

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  page        TEXT    NOT NULL,            -- 對應頁面的 pathname,例如 /blog/foo/
  parent_id   INTEGER,                     -- 回覆對象(預留,v1 暫不串樓)
  nick        TEXT    NOT NULL,            -- 暱稱
  link        TEXT,                        -- 選填網址
  email_hash  TEXT,                        -- 預留(目前不收 email)
  content     TEXT    NOT NULL,            -- 留言內容(純文字,前端 escape 後顯示)
  created_at  INTEGER NOT NULL,            -- epoch ms
  ip_hash     TEXT,                        -- 加鹽雜湊後的來源 IP,僅供防灌水
  status      TEXT    NOT NULL DEFAULT 'visible'  -- visible | deleted
);

CREATE INDEX IF NOT EXISTS idx_comments_page   ON comments(page, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_iphash ON comments(ip_hash, created_at);
