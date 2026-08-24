import { existsSync } from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';

// Dev-only: GitHub Pages serves `index.html` for directory requests, but the
// Astro/Vite dev server does not do directory-index resolution for `public/`
// passthrough assets (e.g. /yaya/, /fishbanks/). This middleware rewrites a
// trailing-slash URL to its `index.html` ONLY when that file actually exists
// under `public/`, so it never shadows Astro's own src/pages routes and has no
// effect on the production build.
function publicDirIndexFallback() {
  const publicDir = path.resolve(process.cwd(), 'public');
  return {
    name: 'public-dir-index-fallback',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        try {
          const u = new URL(req.url, 'http://x');
          if (u.pathname !== '/' && u.pathname.endsWith('/')) {
            const f = path.join(publicDir, u.pathname, 'index.html');
            if (f.startsWith(publicDir) && existsSync(f)) {
              req.url = u.pathname + 'index.html' + u.search;
            }
          }
        } catch {}
        next();
      });
    },
  };
}

// N 體模擬與交通流體力學原本掛在 /math/ 底下，2026-08-24 搬進 /physics/。
// GitHub Pages 是純靜態、沒有伺服器端 301，Astro 只能產生 meta-refresh 的轉址頁
// （訊號比 301 弱，但至少不會留下死連結）。舊網址已經被索引，也散在部落格文章與
// 站外連結裡，所以這兩條要長期保留，不要因為「看起來沒人用」就刪掉。
const MOVED_TO_PHYSICS = {
  '/math/nbody': '/physics/nbody',
  '/math/traffic': '/physics/traffic',
};

export default defineConfig({
  site: 'https://wemee.github.io',
  output: 'static',
  redirects: MOVED_TO_PHYSICS,
  integrations: [
    sitemap({
      // 轉址頁本身沒有內容，不該被列進 sitemap 當成可索引頁面：
      //   /html-css-/        保留給 iThome 外連的舊網址（見 src/pages/html-css-/）
      //   MOVED_TO_PHYSICS   搬家後留下的 meta-refresh 轉址頁
      filter: (page) =>
        !page.includes('/html-css-/') &&
        !Object.keys(MOVED_TO_PHYSICS).some((from) => page.replace(/\/$/, '').endsWith(from)),
    }),
    react(),
  ],

  // Astro 7 預設換成 Sätteri 處理器；部落格依賴 remark-math/rehype-katex 與
  // Shiki 行為，明確設回 remark pipeline
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },

  // Astro 7 預設改為 'jsx' 空白壓縮規則；維持 v6 的 HTML 規則
  compressHTML: true,

  vite: {
    plugins: [tailwindcss(), publicDirIndexFallback()],
    build: {
      rollupOptions: {
        // Pagefind's runtime bundle only exists in dist/ after `pagefind` runs
        // post-build; keep the dynamic import external so Rollup doesn't try to
        // resolve it at build time. It resolves natively in the browser.
        external: [/^\/pagefind\//],
      },
    },
  },
});