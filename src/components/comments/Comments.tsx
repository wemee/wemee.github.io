import { useEffect, useRef, useState } from 'react';
import { COMMENTS_CONFIG } from '@/config/comments';
import { useComments } from './useComments';
import { Turnstile, type TurnstileHandle } from './Turnstile';
import { formatRelative, hueFromName } from './format';
import './comments.css';

const NICK_STORAGE_KEY = 'wemee:comment-nick';

interface CommentsProps {
  /** 對應的頁面路徑,作為留言分組依據 */
  page: string;
}

export default function Comments({ page }: CommentsProps) {
  const { comments, loading, error, submit } = useComments(page);

  const [nick, setNick] = useState('');
  const [content, setContent] = useState('');
  const [link, setLink] = useState('');
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const turnstileRef = useRef<TurnstileHandle>(null);

  // 記住上次用的暱稱,省得每次重打
  useEffect(() => {
    const saved = localStorage.getItem(NICK_STORAGE_KEY);
    if (saved) setNick(saved);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!nick.trim() || !content.trim()) {
      setFormError('暱稱與留言內容不可空白');
      return;
    }
    if (!token) {
      setFormError('請先完成人機驗證');
      return;
    }

    setSubmitting(true);
    const result = await submit({ nick: nick.trim(), content: content.trim(), link: link.trim(), turnstileToken: token });
    setSubmitting(false);

    if (result.ok) {
      localStorage.setItem(NICK_STORAGE_KEY, nick.trim());
      setContent('');
      setLink('');
      setToken('');
      setDone(true);
      turnstileRef.current?.reset();
      window.setTimeout(() => setDone(false), 2500);
    } else {
      setFormError(result.error ?? '送出失敗');
      setToken('');
      turnstileRef.current?.reset();
    }
  }

  return (
    <section className="comments" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="comments-title">
        留言 <span className="comments-count">{comments.length}</span>
      </h2>

      <form className="comment-form" onSubmit={handleSubmit}>
        <div className="comment-form-row">
          <input
            className="comment-input comment-input-nick"
            type="text"
            value={nick}
            maxLength={50}
            placeholder="暱稱"
            onChange={(e) => setNick(e.target.value)}
            aria-label="暱稱"
          />
          <input
            className="comment-input comment-input-link"
            type="url"
            value={link}
            maxLength={200}
            placeholder="網站連結(選填)"
            onChange={(e) => setLink(e.target.value)}
            aria-label="網站連結,選填"
          />
        </div>
        <textarea
          className="comment-input comment-textarea"
          value={content}
          maxLength={2000}
          rows={4}
          placeholder="留個言吧…"
          onChange={(e) => setContent(e.target.value)}
          aria-label="留言內容"
        />

        <Turnstile
          ref={turnstileRef}
          siteKey={COMMENTS_CONFIG.TURNSTILE_SITE_KEY}
          onToken={setToken}
          onExpire={() => setToken('')}
        />

        {formError && <p className="comment-error" role="alert">{formError}</p>}
        {done && <p className="comment-done" role="status">已送出,謝謝你的留言！</p>}

        <button className="comment-submit" type="submit" disabled={submitting}>
          {submitting ? '送出中…' : '送出留言'}
        </button>
      </form>

      {loading && <p className="comment-status">留言載入中…</p>}
      {error && <p className="comment-status comment-status-error">{error}</p>}
      {!loading && !error && comments.length === 0 && (
        <p className="comment-status">還沒有人留言,當第一個吧 👋</p>
      )}

      <ul className="comment-list">
        {comments.map((c) => (
          <li key={c.id} className="comment-item">
            <div
              className="comment-avatar"
              style={{ backgroundColor: `hsl(${hueFromName(c.nick)} 55% 45%)` }}
              aria-hidden="true"
            >
              {c.nick.slice(0, 1).toUpperCase()}
            </div>
            <article className="comment-body">
              <header className="comment-meta">
                {c.link ? (
                  <a className="comment-nick" href={c.link} target="_blank" rel="noopener nofollow ugc">
                    {c.nick}
                  </a>
                ) : (
                  <span className="comment-nick">{c.nick}</span>
                )}
                <time className="comment-time" dateTime={new Date(c.createdAt).toISOString()}>
                  {formatRelative(c.createdAt)}
                </time>
              </header>
              <p className="comment-content">{c.content}</p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
