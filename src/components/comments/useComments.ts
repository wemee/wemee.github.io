import { useCallback, useEffect, useState } from 'react';
import { COMMENTS_CONFIG } from '@/config/comments';

export interface Comment {
  id: number;
  parentId: number | null;
  nick: string;
  link: string | null;
  content: string;
  createdAt: number;
}

export interface NewComment {
  nick: string;
  content: string;
  link: string;
  turnstileToken: string;
}

interface SubmitResult {
  ok: boolean;
  error?: string;
}

/** 載入並送出某個頁面的留言。資料來源是 Cloudflare Worker。 */
export function useComments(page: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const url = `${COMMENTS_CONFIG.API_BASE}/api/comments?page=${encodeURIComponent(page)}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ comments: Comment[] }>;
      })
      .then((data) => {
        if (active) setComments(data.comments ?? []);
      })
      .catch(() => {
        if (active) setError('留言載入失敗,請稍後重試');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page]);

  const submit = useCallback(
    async (input: NewComment): Promise<SubmitResult> => {
      try {
        const res = await fetch(`${COMMENTS_CONFIG.API_BASE}/api/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page, ...input }),
        });
        const data = (await res.json()) as { comment?: Comment; error?: string };

        if (!res.ok || !data.comment) {
          return { ok: false, error: data.error ?? '送出失敗,請稍後重試' };
        }

        setComments((prev) => [...prev, data.comment!]);
        return { ok: true };
      } catch {
        return { ok: false, error: '網路錯誤,請稍後重試' };
      }
    },
    [page],
  );

  return { comments, loading, error, submit };
}
