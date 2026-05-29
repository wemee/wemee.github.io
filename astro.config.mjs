import { existsSync } from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'astro/config';
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

export default defineConfig({
  site: 'https://wemee.github.io',
  output: 'static',
  integrations: [sitemap(), react()],

  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },

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